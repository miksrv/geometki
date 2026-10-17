<?php

namespace App\Libraries\Push;

use App\Libraries\Mail\ActivityMail;
use App\Libraries\Mail\MailQueue;
use App\Libraries\Mail\MailText;
use App\Libraries\NotificationSettings;
use App\Models\PushMessagesModel;
use App\Models\PushSubscriptionsModel;
use App\Models\UsersModel;
use Config\Database;
use Config\Notifications;
use Config\Push as PushConfig;
use DateTime;
use DateTimeZone;
use Throwable;

/**
 * The push queue (`push_messages`): what gets queued, and how a
 * `notifications:send` run sends it.
 *
 * - Every in-app notification of a pushable type is queued (NotifyLibrary), if
 *   the user wants it and has a device with push on.
 * - A push waits `pushDelaySeconds` first and is dropped when the user saw the
 *   notification on the site meanwhile (the toast marks it read).
 * - Pushes about places: after one, the next ones within `pushGroupMinutes` go
 *   out as one; in the quiet hours of the user's device they wait for the morning.
 *   Achievements and levels go at once.
 * - A device the push service no longer knows (404/410) is deleted; whose it was is
 *   kept for a while, for the browser to renew it (Push::renew()).
 */
class PushQueue
{
    private const CHANNEL = 'push';

    /** The rejection of a push whose notification the user saw on the site: as good as delivered */
    public const SEEN_ON_SITE = 'Seen on the site';

    /** The longest a run sends pushes; the rest waits for the next minute */
    private const RUN_SECONDS = 180;

    /** In-app notification type => push type */
    public const NOTIFY_TYPES = [
        'comment'      => 'comment',
        'photo'        => 'photo',
        'rating'       => 'rating',
        'edit'         => 'edit',
        'cover'        => 'cover',
        'bookmark'     => 'bookmark',
        'visit'        => 'visit',
        'achievements' => 'achievement',
        'level'        => 'level',
    ];

    private PushMessagesModel $model;
    private PushSubscriptionsModel $subscriptions;
    private Notifications $config;
    private PushConfig $pushConfig;
    private NotificationSettings $settings;
    private ?PushSender $sender;

    private string $token   = '';
    private int $deadline   = 0;

    /** @var array{sent: int, grouped: int, deferred: int, rejected: int, failed: int, expired: int} */
    private array $stats = [];

    public function __construct(?PushSender $sender = null, ?Notifications $config = null, ?PushConfig $pushConfig = null)
    {
        $this->sender        = $sender;
        $this->model         = new PushMessagesModel();
        $this->subscriptions = new PushSubscriptionsModel();
        $this->config        = $config ?? config('Notifications');
        $this->pushConfig    = $pushConfig ?? config('Push');
        $this->settings      = new NotificationSettings($this->config);
    }

    public function isConfigured(): bool
    {
        return $this->pushConfig->isConfigured();
    }

    // -------------------------------------------------------------------------
    // Queueing
    // -------------------------------------------------------------------------

    /**
     * Queue the push repeating an in-app notification, if its type is pushable,
     * the user wants it and has a device with push on.
     */
    public function queue(string $notifyType, string $userId, ?string $activityId, array|object|null $meta, ?string $notificationId): bool
    {
        $type = self::NOTIFY_TYPES[$notifyType] ?? null;

        if ($type === null || !$this->isConfigured()) {
            return false;
        }

        $user = (new UsersModel())->select('id, settings')->find($userId);

        if (!$user || !$this->settings->isEnabled($user->settings ?? null, self::CHANNEL, $type) || !$this->subscriptions->hasAny($userId)) {
            return false;
        }

        Database::connect()->table('push_messages')
            ->set('id', $this->model->createId())
            ->set('user_id', $userId)
            ->set('type', $type)
            // Only a push about activity on the user's place carries it: a level reached by
            // the user's own action must not count as a push about that action (the email
            // of the place owner looks the activity up)
            ->set('activity_id', $this->settings->isActivityType($type) ? $activityId : null)
            ->set('notification_id', $notificationId)
            ->set('meta', $meta !== null ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null)
            ->set('status', 'created')
            ->set('next_attempt_at', 'DATE_ADD(NOW(), INTERVAL ' . $this->config->pushDelaySeconds . ' SECOND)', false)
            ->insert();

        return true;
    }

    // -------------------------------------------------------------------------
    // Sending
    // -------------------------------------------------------------------------

    /**
     * One run: expire and release what is stuck, claim a batch, send it.
     *
     * @param callable(string, string): void|null $log
     *
     * @return array{sent: int, grouped: int, deferred: int, rejected: int, failed: int, expired: int}
     */
    public function process(?callable $log = null): array
    {
        $log ??= static fn (string $line, string $color = 'white') => null;
        $this->stats = ['sent' => 0, 'grouped' => 0, 'deferred' => 0, 'rejected' => 0, 'failed' => 0, 'expired' => 0];

        // created_at of a push is the column default: the database clock. Expired even when
        // push is off now: a queued push keeps the email about its event waiting
        $this->stats['expired'] = $this->model->expireOlderThanHours($this->config->pushExpireAfterHours);
        $this->model->releaseStale($this->config->staleLockMinutes, $this->config->maxAttempts);

        if (!$this->isConfigured()) {
            return $this->stats;
        }

        $this->token = bin2hex(random_bytes(8));
        // Push services can be slow: this stage keeps within its own, shorter budget
        $this->deadline = time() + min(self::RUN_SECONDS, intdiv($this->config->staleLockMinutes * 60, 2));

        $rows = $this->model->claim($this->token, $this->config->pushBatchSize);

        if (!$rows) {
            return $this->stats;
        }

        // Whatever happens below, the rows the run did not finish go back to the queue
        try {
            $this->processRows($rows);
        } finally {
            if ($released = $this->model->releaseRun($this->token)) {
                $log("{$released} pushes left for the next run.", 'yellow');
            }
        }

        return $this->stats;
    }

    /**
     * @param object[] $rows The claimed rows
     */
    private function processRows(array $rows): void
    {
        $userIds = array_values(array_unique(array_map(static fn ($row) => $row->user_id, $rows)));
        $users   = [];

        foreach ((new UsersModel())->select('id, locale, settings')->whereIn('id', $userIds)->findAll() as $user) {
            $users[$user->id] = $user;
        }

        $devices = $this->subscriptions->forUsers($userIds);
        $seen    = $this->seenNotifications(array_filter(array_map(static fn ($row) => $row->notification_id, $rows)));

        $activityByUser = [];

        foreach ($rows as $row) {
            $user = $users[$row->user_id] ?? null;

            $reason = match (true) {
                !$user                                                                    => 'No recipient: the user is deleted',
                !$this->settings->isEnabled($user->settings ?? null, self::CHANNEL, $row->type) => 'The user turned this notification off',
                empty($devices[$row->user_id])                                            => 'No device with push on',
                $row->notification_id && isset($seen[$row->notification_id])              => self::SEEN_ON_SITE,
                default                                                                   => null,
            };

            if ($reason !== null) {
                $this->guarded([$row], function () use ($row, $reason) {
                    $this->model->markRejected([$row->id], $this->token, $reason);
                    $this->stats['rejected']++;
                });
                continue;
            }

            if ($this->settings->isActivityType($row->type) && $row->activity_id) {
                $activityByUser[$row->user_id][] = $row;
                continue;
            }

            if ($this->outOfTime()) {
                return;
            }

            $this->guarded([$row], fn () => $this->sendPersonal($row, $user, $devices[$row->user_id]));
        }

        foreach ($activityByUser as $userId => $userRows) {
            if ($this->outOfTime()) {
                return;
            }

            $this->guarded($userRows, fn () => $this->sendActivity($userRows, $users[$userId], $devices[$userId]));
        }
    }

    /**
     * Once a day: delete old queue rows, devices that keep failing and the expired
     * devices no longer renewable.
     *
     * @return array{messages: int, subscriptions: int, expired: int}
     */
    public function cleanup(): array
    {
        return [
            'messages'      => $this->model->purgeOlderThan($this->config->retentionDays),
            'subscriptions' => $this->subscriptions->deleteFailing($this->config->subscriptionMaxFailures),
            'expired'       => $this->subscriptions->purgeExpired($this->config->expiredSubscriptionDays),
        ];
    }

    /**
     * A test push to every device of the user, at once (the settings page).
     *
     * @return array{sent: int, devices: int}
     */
    public function sendTest(string $userId, string $locale): array
    {
        $devices = $this->subscriptions->forUsers([$userId])[$userId] ?? [];

        if (!$devices) {
            return ['sent' => 0, 'devices' => 0];
        }

        $sent = $this->sendToDevices($devices, PushPayload::test($locale), 'test');

        return ['sent' => $sent, 'devices' => count($devices)];
    }

    /**
     * An achievement or a new level: one push, at once.
     */
    private function sendPersonal(object $row, object $user, array $devices): void
    {
        $locale = MailText::locale($user->locale ?? null);
        $meta   = json_decode((string) $row->meta, true) ?: [];

        $payload = match ($row->type) {
            'achievement' => PushPayload::achievement($meta, $user->id, $locale),
            'level'       => PushPayload::level($meta, $user->id, $locale),
            default       => null,
        };

        if ($payload === null) {
            $this->model->markRejected([$row->id], $this->token, 'Unknown push type');
            $this->stats['rejected']++;

            return;
        }

        $this->deliver($payload, $row, [], $devices);
    }

    /**
     * @param object[] $rows The user's claimed activity rows, oldest first
     */
    private function sendActivity(array $rows, object $user, array $devices): void
    {
        $ids = array_map(static fn ($row) => $row->id, $rows);

        if ($endsAt = $this->model->activityIntervalEndsAt($user->id, $this->config->pushGroupMinutes)) {
            $this->model->deferUntil($ids, $this->token, $endsAt);
            $this->stats['deferred'] += count($ids);

            return;
        }

        if (($wait = self::secondsUntilQuietEnd($devices[0]->timezone ?? null, $this->config->quietHoursStart, $this->config->quietHoursEnd, time())) > 0) {
            $this->model->deferForSeconds($ids, $this->token, $wait);
            $this->stats['deferred'] += count($ids);

            return;
        }

        $locale = MailText::locale($user->locale ?? null);
        $events = ActivityMail::loadEvents(array_map(static fn ($row) => $row->activity_id, $rows), $locale);
        $found  = array_flip(array_column($events, 'activityId'));

        $missing = array_values(array_filter($rows, static fn ($row) => !isset($found[$row->activity_id])));

        if ($missing) {
            $this->model->markRejected(array_map(static fn ($row) => $row->id, $missing), $this->token, 'The activity or its place was deleted');
            $this->stats['rejected'] += count($missing);
        }

        $rows = array_values(array_filter($rows, static fn ($row) => isset($found[$row->activity_id])));

        if (!$rows) {
            return;
        }

        $main = array_shift($rows);

        $this->deliver(PushPayload::activity($events, $user->id, $locale), $main, array_map(static fn ($row) => $row->id, $rows), $devices);
    }

    /**
     * @param string[] $groupedIds Rows that go out inside $main's push
     * @param object[] $devices
     */
    private function deliver(array $payload, object $main, array $groupedIds, array $devices): void
    {
        $sent = $this->sendToDevices($devices, $payload, $payload['tag'] ?? null, $reasons, $left);

        if ($sent > 0) {
            $this->model->markSent($main->id, $this->token, $groupedIds);
            $this->stats['sent']++;
            $this->stats['grouped'] += count($groupedIds);

            return;
        }

        $this->stats['failed']++;

        // Every device is gone: nothing to retry, the email stands in
        if ($left === 0) {
            $this->model->markRejected([$main->id, ...$groupedIds], $this->token, 'No device with push on any more');

            return;
        }

        $retry = MailQueue::retryDelayMinutes((int) $main->attempts + 1, $this->config->maxAttempts, $this->config->retryBaseMinutes);

        $this->model->markFailed([$main->id], $this->token, implode('; ', $reasons) ?: 'Push service error', $retry);
        $this->model->requeue($groupedIds, $this->token, $retry ?? $this->config->retryBaseMinutes);
    }

    /**
     * Send to every device, keeping the device list healthy: a device the push
     * service no longer knows is deleted, a failure is counted.
     *
     * @param object[] $devices
     * @param-out string[] $reasons
     * @param-out int $left Devices that still exist
     *
     * @return int Devices the push reached
     */
    private function sendToDevices(array $devices, array $payload, ?string $topic, ?array &$reasons = [], ?int &$left = 0): int
    {
        $results = $this->sender()->send($devices, $payload, array_filter([
            'TTL'     => $this->config->pushTtl,
            'urgency' => 'normal',
            'topic'   => $topic !== null ? substr(preg_replace('/[^A-Za-z0-9_-]/', '', $topic), 0, 32) : null,
        ]));

        $sent    = 0;
        $reasons = [];
        $left    = count($devices);

        foreach ($devices as $device) {
            $result = $results[$device->id] ?? ['ok' => false, 'expired' => false, 'reason' => 'No report'];

            if ($result['ok']) {
                $this->subscriptions->markSuccess($device->id);
                $sent++;
            } elseif ($result['expired']) {
                $this->subscriptions->expire($device);
                $left--;
            } else {
                $this->subscriptions->markFailure($device->id);
                $reasons[] = $result['reason'];
            }
        }

        return $sent;
    }

    /**
     * Notifications of these ids the user has already seen on the site.
     *
     * @param string[] $ids
     *
     * @return array<string, true>
     */
    private function seenNotifications(array $ids): array
    {
        if (!$ids) {
            return [];
        }

        $rows = Database::connect()->table('users_notifications')
            ->select('id')
            ->whereIn('id', array_values($ids))
            ->where('read', 1)
            ->get()
            ->getResult();

        return array_fill_keys(array_column($rows, 'id'), true);
    }

    /**
     * Seconds until the quiet hours end in the given time zone; 0 outside them.
     * Unknown time zone: the site's own (Europe/Moscow).
     */
    public static function secondsUntilQuietEnd(?string $timezone, int $start, int $end, int $now): int
    {
        try {
            $zone = new DateTimeZone($timezone ?: 'Europe/Moscow');
        } catch (Throwable) {
            $zone = new DateTimeZone('Europe/Moscow');
        }

        $local = (new DateTime('@' . $now))->setTimezone($zone);
        $hour  = (int) $local->format('G');
        $quiet = $start > $end ? ($hour >= $start || $hour < $end) : ($hour >= $start && $hour < $end);

        if (!$quiet) {
            return 0;
        }

        $morning = (clone $local)->setTime($end, 0);

        if ($morning->getTimestamp() <= $now) {
            $morning->modify('+1 day');
        }

        return $morning->getTimestamp() - $now;
    }

    private function outOfTime(): bool
    {
        return time() >= $this->deadline;
    }

    /**
     * An unexpected error counts as a failed attempt: rows neither stay locked nor loop.
     *
     * @param object[] $rows
     */
    private function guarded(array $rows, callable $send): void
    {
        try {
            $send();
        } catch (Throwable $e) {
            $retry = MailQueue::retryDelayMinutes((int) $rows[0]->attempts + 1, $this->config->maxAttempts, $this->config->retryBaseMinutes);

            $this->model->markFailed(array_map(static fn ($row) => $row->id, $rows), $this->token, $e->getMessage(), $retry);
            $this->stats['failed']++;
            log_message('error', '{exception}', ['exception' => $e]);
        }
    }

    private function sender(): PushSender
    {
        return $this->sender ??= new PushSender($this->pushConfig);
    }
}
