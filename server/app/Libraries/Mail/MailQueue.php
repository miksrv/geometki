<?php

namespace App\Libraries\Mail;

use App\Entities\SendingMailEntity;
use App\Libraries\NotificationSettings;
use App\Models\PushMessagesModel;
use App\Models\SendingMail;
use App\Models\UsersModel;
use Config\Database;
use Config\Notifications;
use Throwable;

/**
 * The email queue (`sending_mail`): what gets queued, and how a
 * `notifications:send` run sends it.
 *
 * - Activity emails: the first one goes out at once; the ones that follow
 *   within `activityEmailIntervalHours` wait for the interval to end and go
 *   out together as one email.
 * - Every row is checked against the recipient's current settings when it is
 *   sent, so turning a notification off stops what is already queued.
 * - Push instead of email: an event a push already told about is not emailed;
 *   the email waits while the push does, and goes when the push failed.
 * - Weekly digests keep within the hosting limits (`digestHourLimit`,
 *   `digestDayLimit`): over them they wait in the queue for the next runs.
 * - Failed sends are retried with exponential back-off; an address the mail
 *   server rejects as nonexistent is marked and gets no more notifications.
 */
class MailQueue
{
    private const CHANNEL = 'email';
    private const DIGEST  = 'digest';

    /** An email whose event still has a push waiting looks again after this long */
    private const PUSH_WAIT_SECONDS = 15 * 60;

    private SendingMail $model;
    private Notifications $config;
    private NotificationSettings $settings;
    private ?Mailer $mailer;
    private ?UnsubscribeToken $tokens = null;

    /** The run's lock token, its deadline, and the bounces it saw (applied at the end) */
    private string $token = '';
    private int $deadline = 0;

    /** @var array<int, array{user: string, rows: string[], error: string}> */
    private array $bounces = [];

    /** @var array{sent: int, grouped: int, deferred: int, rejected: int, failed: int, expired: int} */
    private array $stats = [];

    public function __construct(?Mailer $mailer = null, ?SendingMail $model = null, ?Notifications $config = null)
    {
        $this->mailer   = $mailer;
        $this->model    = $model ?? new SendingMail();
        $this->config   = $config ?? config('Notifications');
        $this->settings = new NotificationSettings($this->config);
    }

    // -------------------------------------------------------------------------
    // Queueing
    // -------------------------------------------------------------------------

    /**
     * Queue the email about an activity on the user's place, if the user wants it.
     *
     * @param object $user Row with id, email, locale, settings
     */
    public function queueActivity(object $user, string $type, string $activityId): bool
    {
        if (empty($user->email) || !empty($user->email_bounced_at) || $this->settings->isServiceEmail($user->email) || !$this->settings->isEnabled($user->settings ?? null, self::CHANNEL, $type)) {
            return false;
        }

        $this->model->insert([
            'activity_id' => $activityId,
            'user_id'     => $user->id,
            'type'        => $type,
            'status'      => 'created',
            'email'       => $user->email,
            'locale'      => MailText::locale($user->locale ?? null),
        ]);

        return true;
    }

    /**
     * Queue a weekly digest whose body is already rendered.
     */
    public function queueDigest(object $user, string $subject, string $body): void
    {
        if ($this->settings->isServiceEmail($user->email ?? null)) {
            return;
        }

        $this->model->insert([
            'user_id' => $user->id,
            'type'    => 'digest',
            'status'  => 'created',
            'email'   => $user->email,
            'locale'  => MailText::locale($user->locale ?? null),
            'subject' => $subject,
            'message' => $body,
        ]);
    }

    // -------------------------------------------------------------------------
    // Sending
    // -------------------------------------------------------------------------

    /**
     * One run: expire and release what is stuck, claim a batch of activity
     * emails and the digests the hosting limits allow, send them.
     *
     * @param callable(string, string): void|null $log Progress lines (text, colour)
     *
     * @return array{sent: int, grouped: int, deferred: int, rejected: int, failed: int, expired: int}
     */
    public function process(?callable $log = null): array
    {
        $log ??= static fn (string $line, string $color = 'white') => null;
        $this->stats = ['sent' => 0, 'grouped' => 0, 'deferred' => 0, 'rejected' => 0, 'failed' => 0, 'expired' => 0];

        $this->stats['expired'] = $this->model->expireCreatedBefore(self::daysAgo($this->config->expireAfterDays), [self::DIGEST], true)
            + $this->model->expireCreatedBefore(self::daysAgo($this->config->digestExpireAfterDays), [self::DIGEST]);
        $this->model->releaseStale($this->config->staleLockMinutes, $this->config->maxAttempts);

        $this->token    = bin2hex(random_bytes(8));
        $this->deadline = time() + intdiv($this->config->staleLockMinutes * 60, 2);
        $this->bounces  = [];

        // Activity notifications: not limited
        $rows = $this->model->claim($this->token, $this->config->batchSize, [self::DIGEST], true);

        // Digests: within the hosting limits; over them they wait for the next runs
        $digestBudget = self::digestBudget(
            $this->config,
            $this->model->countSentSince(60, self::DIGEST),
            $this->model->countSentSince(24 * 60, self::DIGEST),
        );

        if ($digestBudget > 0) {
            $rows = $this->model->claim($this->token, $digestBudget, [self::DIGEST]);
        } elseif ($this->model->where('status', 'created')->where('type', self::DIGEST)->countAllResults() > 0) {
            $log('Digest limit of the hosting reached: the digests wait for the next runs.', 'yellow');
        }

        if (!$rows) {
            return $this->stats;
        }

        // Whatever happens below, the rows the run did not finish go back to the queue
        try {
            $this->processRows($rows, $log);
        } finally {
            if ($released = $this->model->releaseRun($this->token)) {
                $log("{$released} emails left for the next run.", 'yellow');
            }
        }

        return $this->stats;
    }

    /**
     * @param SendingMailEntity[]                 $rows The claimed rows
     * @param callable(string, string): void      $log
     */
    private function processRows(array $rows, callable $log): void
    {
        $users = $this->loadUsers(array_filter(array_unique(array_map(static fn ($row) => $row->user_id, $rows))));

        $activityByUser = [];

        foreach ($rows as $row) {
            $user = $users[$row->user_id] ?? null;

            // One bad row (a broken settings value) must not stop the others
            try {
                $reason = $this->rejectReason($row, $user);
            } catch (Throwable $e) {
                $this->guarded([$row], static fn () => throw $e);
                continue;
            }

            if ($reason) {
                $this->guarded([$row], function () use ($row, $reason) {
                    $this->model->markRejected([$row->id], $this->token, $reason);
                    $this->stats['rejected']++;
                });
                continue;
            }

            if ($row->activity_id) {
                $activityByUser[$row->user_id][] = $row;
                continue;
            }

            if ($this->outOfTime()) {
                break;
            }

            $this->guarded([$row], fn () => $this->sendDigest($row, $user));
        }

        foreach ($activityByUser as $userId => $userRows) {
            if ($this->outOfTime()) {
                break;
            }

            $this->guarded($userRows, fn () => $this->sendActivity($userRows, $users[$userId]));
        }

        $this->settleBounces($log);
    }

    /**
     * A run stops at half the stale-lock time, so no other run ever takes its
     * rows as stale while it still sends them.
     */
    private function outOfTime(): bool
    {
        return time() >= $this->deadline;
    }

    /**
     * Why a row must not be sent, or null.
     */
    private function rejectReason(SendingMailEntity $row, ?object $user): ?string
    {
        if (!$user) {
            return 'No recipient: the user is deleted or unknown';
        }

        if (empty($user->email)) {
            return 'The user has no email address';
        }

        if (!empty($user->email_bounced_at)) {
            return 'The address was rejected by the mail server earlier';
        }

        $type = $row->type ?: ($row->activity_id ? null : 'digest');

        if (!$type || !$this->settings->isKnownType($type)) {
            return 'Unknown email type';
        }

        if (!$this->settings->isEnabled($user->settings ?? null, self::CHANNEL, $type)) {
            return 'The user turned this notification off';
        }

        if (!$row->activity_id && empty($row->message)) {
            return 'Empty message';
        }

        return null;
    }

    private function sendDigest(SendingMailEntity $row, object $user): void
    {
        // The body and subject were rendered in the locale of the queue time: the frame follows it
        $locale  = MailText::locale($row->locale ?: ($user->locale ?? null));
        $subject = $row->subject ?: DigestMail::subject($locale);
        $token   = $this->tokens()->create($user->id, 'digest');
        $result  = DigestMail::render($row->message, $subject, $locale, MailUrls::unsubscribePage($locale, $token));

        $this->deliver(
            new EmailMessage($user->email, $subject, $result['html'], $result['text'], MailUrls::oneClickUnsubscribe($token), 'digest'),
            $row,
            [],
            $user,
        );
    }

    /**
     * @param SendingMailEntity[] $rows The user's claimed activity rows, oldest first
     */
    private function sendActivity(array $rows, object $user): void
    {
        $ids = array_map(static fn ($row) => $row->id, $rows);

        if ($endsAt = $this->model->activityIntervalEndsAt($user->id, $this->config->activityEmailIntervalHours * 60)) {
            $this->model->deferUntil($ids, $this->token, $endsAt);
            $this->stats['deferred'] += count($ids);

            return;
        }

        // Push instead of email: an event the push already told about is not emailed;
        // while its push still waits (grouping, quiet hours), the email waits too
        $outcomes = (new PushMessagesModel())->outcomesByActivity($user->id, array_map(static fn ($row) => $row->activity_id, $rows));
        $byPush   = array_values(array_filter($rows, static fn ($row) => ($outcomes[$row->activity_id] ?? null) === 'delivered'));
        $waiting  = array_values(array_filter($rows, static fn ($row) => ($outcomes[$row->activity_id] ?? null) === 'pending'));

        if ($byPush) {
            $this->model->markRejected(array_map(static fn ($row) => $row->id, $byPush), $this->token, 'Delivered as push or seen on the site');
            $this->stats['rejected'] += count($byPush);
        }

        if ($waiting) {
            $this->model->deferForSeconds(array_map(static fn ($row) => $row->id, $waiting), $this->token, self::PUSH_WAIT_SECONDS);
            $this->stats['deferred'] += count($waiting);
        }

        $rows = array_values(array_filter($rows, static fn ($row) => !isset($outcomes[$row->activity_id]) || $outcomes[$row->activity_id] === 'failed'));

        if (!$rows) {
            return;
        }

        $locale = MailText::locale($user->locale ?? null);
        $events = ActivityMail::loadEvents(array_map(static fn ($row) => $row->activity_id, $rows), $locale);

        // Activity or place deleted since: nothing to tell about these rows
        $found   = array_flip(array_column($events, 'activityId'));
        $missing = array_values(array_filter($rows, static fn ($row) => !isset($found[$row->activity_id])));

        if ($missing) {
            $this->model->markRejected(array_map(static fn ($row) => $row->id, $missing), $this->token, 'The activity or its place was deleted');
            $this->stats['rejected'] += count($missing);
        }

        $rows = array_values(array_filter($rows, static fn ($row) => isset($found[$row->activity_id])));

        if (!$rows) {
            return;
        }

        $token  = $this->tokens()->create($user->id, ActivityMail::unsubscribeType($events));
        $result = ActivityMail::render($events, (string) $user->name, $locale, MailUrls::unsubscribePage($locale, $token));

        $main    = array_shift($rows);
        $grouped = array_map(static fn ($row) => $row->id, $rows);

        $this->deliver(
            new EmailMessage($user->email, $result['subject'], $result['html'], $result['text'], MailUrls::oneClickUnsubscribe($token), 'activity'),
            $main,
            $grouped,
            $user,
            $result['subject'],
        );
    }

    /**
     * Send one email for $main (and the rows grouped into it) and record the outcome.
     * A failure is counted against $main only; the grouped rows go back to the
     * queue with it and spend no attempt of their own.
     *
     * @param string[] $groupedIds Rows that go out inside $main's email
     */
    private function deliver(EmailMessage $message, SendingMailEntity $main, array $groupedIds, object $user, ?string $subject = null): void
    {
        try {
            $this->mailer()->send($message);
        } catch (MailerException $e) {
            $this->stats['failed']++;

            log_message('error', '[Mail] Sending {id} to user {user} failed: {error}', [
                'id'    => $main->id,
                'user'  => $user->id,
                'error' => $e->getMessage(),
            ]);

            if ($e->permanent) {
                // Decided at the end of the run: many at once means our own setup is broken
                $this->bounces[] = ['user' => $user->id, 'rows' => [$main->id, ...$groupedIds], 'error' => $e->getMessage()];

                return;
            }

            $retry = self::retryDelayMinutes((int) $main->attempts + 1, $this->config->maxAttempts, $this->config->retryBaseMinutes);

            $this->model->markFailed([$main->id], $this->token, $e->getMessage(), $retry);
            $this->model->requeue($groupedIds, $this->token, $retry ?? $this->config->retryBaseMinutes);

            return;
        }

        // Sent: from here on nothing may lead to sending it again
        try {
            if (!$this->model->markSent($main->id, $this->token, $groupedIds, $subject !== null ? ['subject' => mb_substr($subject, 0, 255)] : [])) {
                log_message('critical', '[Mail] {id} was sent but its lock had been taken over by another run', ['id' => $main->id]);
            }

            $this->stats['sent']++;
            $this->stats['grouped'] += count($groupedIds);
        } catch (Throwable $e) {
            log_message('critical', '[Mail] {id} was sent but could not be marked sent: {exception}', ['id' => $main->id, 'exception' => $e]);
            $this->stats['sent']++;
        }
    }

    /**
     * Mark the addresses the mail server rejected as nonexistent — unless the
     * run saw more of them than `maxBouncesPerRun` and sent nothing: that is a
     * broken sender setup (a wrong smtp.mail, a blocked account), not a batch
     * of dead mailboxes, so the emails are retried instead.
     *
     * @param callable(string, string): void $log
     */
    private function settleBounces(callable $log): void
    {
        if (!$this->bounces) {
            return;
        }

        $broken = count($this->bounces) > $this->config->maxBouncesPerRun && $this->stats['sent'] === 0;

        if ($broken) {
            $log('Every address was rejected: check the SMTP sender settings. Nothing marked as bounced.', 'red');
            log_message('critical', '[Mail] {count} addresses rejected in one run and nothing sent: SMTP sender setup? Not marking bounces.', ['count' => count($this->bounces)]);
        }

        foreach ($this->bounces as $bounce) {
            if ($broken) {
                $this->model->requeue($bounce['rows'], $this->token, $this->config->retryBaseMinutes * 6);
                continue;
            }

            $this->model->markFailed($bounce['rows'], $this->token, $bounce['error'], null);

            // Not through the model: users.updated_at is the profile's "last modified" (sitemap)
            Database::connect()->table('users')->where('id', $bounce['user'])->update(['email_bounced_at' => date('Y-m-d H:i:s')]);
        }
    }

    /**
     * Run $send for claimed rows; an unexpected error (a bug in building the
     * email, the database) counts as a failed attempt, so the rows neither stay
     * locked nor loop forever. Only rows the run still holds are touched.
     *
     * @param SendingMailEntity[] $rows
     */
    private function guarded(array $rows, callable $send): void
    {
        try {
            $send();
        } catch (Throwable $e) {
            $attempts = (int) $rows[0]->attempts + 1;
            $retry    = self::retryDelayMinutes($attempts, $this->config->maxAttempts, $this->config->retryBaseMinutes);

            $this->model->markFailed(array_map(static fn ($row) => $row->id, $rows), $this->token, $e->getMessage(), $retry);
            $this->stats['failed']++;
            log_message('error', '{exception}', ['exception' => $e]);
        }
    }

    /**
     * How many digests a run may send: the batch size, cut to what is left of
     * the hourly and the daily hosting limit.
     */
    public static function digestBudget(Notifications $config, int $sentLastHour, int $sentLastDay): int
    {
        return max(0, min(
            $config->batchSize,
            $config->digestHourLimit - $sentLastHour,
            $config->digestDayLimit - $sentLastDay,
        ));
    }

    private static function daysAgo(int $days): string
    {
        return date('Y-m-d H:i:s', strtotime("-{$days} days"));
    }

    /**
     * Minutes until the next attempt after $attempts failed ones, or null to give up.
     */
    public static function retryDelayMinutes(int $attempts, int $maxAttempts, int $baseMinutes, bool $permanent = false): ?int
    {
        if ($permanent || $attempts >= $maxAttempts) {
            return null;
        }

        return $baseMinutes * (2 ** max(0, $attempts - 1));
    }

    /**
     * @param string[] $ids
     *
     * @return array<string, object>
     */
    private function loadUsers(array $ids): array
    {
        if (!$ids) {
            return [];
        }

        $rows = (new UsersModel())
            ->select('id, name, email, email_bounced_at, locale, settings')
            ->whereIn('id', array_values($ids))
            ->findAll();

        $users = [];
        foreach ($rows as $row) {
            $users[$row->id] = $row;
        }

        return $users;
    }

    private function mailer(): Mailer
    {
        return $this->mailer ??= new Mailer();
    }

    private function tokens(): UnsubscribeToken
    {
        return $this->tokens ??= new UnsubscribeToken();
    }
}
