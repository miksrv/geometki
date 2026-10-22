<?php

/**
 * Run from CLI:
 *   php spark digest:weekly
 *   php spark digest:weekly --user <user_id>
 *   php spark digest:weekly --user <user_id> --dry-run
 *
 * Add to cron (once a week, e.g. every Monday at 09:00):
 *   0 9 * * 1 cd /path/to/server && php spark digest:weekly >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Libraries\DigestService;
use App\Libraries\Mail\DigestMail;
use App\Libraries\Mail\MailQueue;
use App\Libraries\Mail\MailText;
use App\Libraries\NotificationSettings;
use App\Models\UsersModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class WeeklyDigestCommand extends BaseCommand
{
    protected $group       = 'digest';
    protected $name        = 'digest:weekly';
    protected $description = 'Generate and queue weekly digest emails for every user who wants one';
    protected $usage       = 'digest:weekly [--user <user_id>] [--dry-run] [--force]';
    protected $options     = [
        '--user'    => 'Process only this user ID (for testing)',
        '--dry-run' => 'Print digest data without inserting into sending_mail',
        '--debug'   => 'Print step-by-step diagnostic output for each user',
        '--weeks'   => 'Look-back window in weeks (default: 1). Use --weeks 4 for testing on older data.',
        '--force'   => 'Queue even for users who got a digest less than a week ago',
    ];

    /**
     * Hard-coded user ID for local debugging without CLI flags.
     * Set to a real user ID to test without passing --user each time.
     * Must remain null in production commits.
     */
    private const DEBUG_USER_ID = null;

    public function run(array $params): void
    {
        $targetUserId = CLI::getOption('user') ?? self::DEBUG_USER_ID;
        $isDryRun     = CLI::getOption('dry-run') !== null;
        $isForced     = CLI::getOption('force') !== null;
        $minInterval  = config('Notifications')->digestMinIntervalDays;

        // Week window: configurable look-back (default 1 week, use --weeks N for testing)
        $weeks     = max(1, (int) (CLI::getOption('weeks') ?? 1));
        $weekEnd   = date('Y-m-d H:i:s');
        $weekStart = date('Y-m-d H:i:s', strtotime("-{$weeks} weeks"));

        $usersModel    = new UsersModel();
        $mailQueue     = new MailQueue();
        $digestService = new DigestService();
        $settings      = new NotificationSettings();

        // Resolve user list
        if ($targetUserId !== null) {
            $user = $usersModel->find($targetUserId);
            if (!$user) {
                CLI::error("User not found: {$targetUserId}");
                return;
            }
            $users = [$user];

            if (!$isForced && (!empty($user->email_bounced_at) || !$settings->isEnabled($user->settings ?? null, 'email', 'digest'))) {
                CLI::write("{$user->name} has the digest off or an undeliverable address (use --force to queue anyway)", 'yellow');
                return;
            }
        } else {
            // Everyone with an address: authors get the news of their places,
            // the others the popular places of the week and the week on the site
            $users = $usersModel
                ->where('email IS NOT NULL', null, false)
                ->where('email !=', '')
                ->where('deleted_at IS NULL', null, false)
                ->findAll();

            // Only users who want the digest and whose address works; service accounts get none
            $users = array_values(array_filter($users, static fn ($user) =>
                empty($user->email_bounced_at)
                && !$settings->isServiceEmail($user->email ?? null)
                && $settings->isEnabled($user->settings ?? null, 'email', 'digest')
            ));
        }

        if (empty($users)) {
            CLI::write('No eligible users found.', 'yellow');
            return;
        }

        $isDebug   = CLI::getOption('debug') !== null;
        $processed = 0;
        $queued    = 0;
        $skipped   = 0;

        if ($isDebug) {
            CLI::write("Week window: {$weekStart} → {$weekEnd}", 'yellow');
        }

        foreach ($users as $user) {
            $processed++;

            if (empty($user->email)) {
                CLI::write("Skipping {$user->name}: no email address", 'yellow');
                $skipped++;
                continue;
            }

            if ($isDebug) {
                CLI::write("--- Debug: {$user->name} (id={$user->id}) ---", 'cyan');
                $weekSummary   = $digestService->buildWeekSummary($user->id, $weekStart, $weekEnd);
                $placeActivity = $digestService->buildPlaceActivitySection($user->id, $weekStart, $weekEnd);
                CLI::write('  week_summary:   ' . ($weekSummary   === null ? 'NULL' : json_encode($weekSummary)), 'white');
                CLI::write('  place_activity: ' . ($placeActivity === null ? 'NULL' : json_encode($placeActivity)), 'white');
                $db = \Config\Database::connect();
                $placesCount = $db->query('SELECT COUNT(*) AS cnt FROM places WHERE user_id = ? AND deleted_at IS NULL', [$user->id])->getRow();
                CLI::write('  places owned: ' . ($placesCount->cnt ?? 0), 'white');
                $activityCount = $db->query(
                    "SELECT COUNT(*) AS cnt
                     FROM activity a
                     JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL AND p.user_id = ?
                     WHERE a.user_id != ? AND a.created_at BETWEEN ? AND ?
                       AND a.type IN ('rating','comment','photo','edit') AND a.deleted_at IS NULL",
                    [$user->id, $user->id, $weekStart, $weekEnd]
                )->getRow();
                CLI::write('  activity on user places this week: ' . ($activityCount->cnt ?? 0), 'white');
                $viewsCount = $db->query(
                    "SELECT COALESCE(SUM(pvl.count), 0) AS cnt
                     FROM places_views_log pvl
                     JOIN places p ON p.id = pvl.place_id AND p.deleted_at IS NULL AND p.user_id = ?
                     WHERE pvl.view_date BETWEEN DATE(?) AND DATE(?)",
                    [$user->id, $weekStart, $weekEnd]
                )->getRow();
                CLI::write('  views on user places this week: ' . ($viewsCount->cnt ?? 0), 'white');
                CLI::write('');
            }

            // Running twice in a week (by hand, a cron mistake) must not mail anyone twice
            if (!$isForced && !empty($user->digest_sent_at) && strtotime((string) $user->digest_sent_at) > strtotime("-{$minInterval} days")) {
                CLI::write("Skipping {$user->name}: got a digest on {$user->digest_sent_at}", 'yellow');
                $skipped++;
                continue;
            }

            $locale   = MailText::locale($user->locale ?? null);
            $sections = $digestService->generateForUser($user->id, $weekStart, $weekEnd, $locale);

            // A week with nothing on the site at all is not worth an email
            if (!DigestMail::hasNews($sections)) {
                CLI::write("Skipping {$user->name}: nothing happened this week", 'yellow');
                $skipped++;
                continue;
            }

            // The body is rendered now (it needs this week's data); the queue
            // wraps it in the email layout when sending
            $digestHtml = DigestMail::body((string) $user->name, $sections, $locale);
            $subject    = DigestMail::subject($locale, $sections);

            if ($isDryRun) {
                CLI::write("--- Dry run for: {$user->name} ({$user->email}) ---", 'cyan');
                CLI::write('Subject: ' . $subject, 'cyan');
                CLI::write('Sections: ' . implode(', ', array_keys($sections)), 'white');
                CLI::write('Digest preview: ' . substr(strip_tags($digestHtml), 0, 300), 'white');
                CLI::write('');
                continue; // dry-run does not count as queued
            }

            // One user's failed insert (e.g. a body over the column size) must not stop the run
            try {
                $mailQueue->queueDigest($user, $subject, $digestHtml);
            } catch (\Throwable $e) {
                log_message('error', 'Digest for {user} not queued: {message}', ['user' => $user->id, 'message' => $e->getMessage()]);
                CLI::write("Failed to queue digest for: {$user->name}", 'red');
                $skipped++;
                continue;
            }

            // Not through the model: users.updated_at is the profile's "last modified" (sitemap)
            \Config\Database::connect()->table('users')
                ->where('id', $user->id)
                ->update(['digest_sent_at' => date('Y-m-d H:i:s')]);

            CLI::write("Queued digest for: {$user->name} ({$user->email})", 'green');
            $queued++;
        }

        CLI::write('');
        CLI::write('Digest processing complete.', 'green');
        CLI::write('  Processed: ' . $processed, 'green');
        CLI::write('  Queued:    ' . $queued,    'green');
        CLI::write('  Skipped:   ' . $skipped,   $skipped > 0 ? 'yellow' : 'green');
    }
}
