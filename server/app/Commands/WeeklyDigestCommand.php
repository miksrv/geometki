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
use App\Models\SendingMail;
use App\Models\UsersModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class WeeklyDigestCommand extends BaseCommand
{
    protected $group       = 'digest';
    protected $name        = 'digest:weekly';
    protected $description = 'Generate and queue weekly digest emails for all users';
    protected $usage       = 'digest:weekly [--user <user_id>] [--dry-run]';
    protected $options     = [
        '--user'    => 'Process only this user ID (for testing)',
        '--dry-run' => 'Print digest data without inserting into sending_mail',
        '--debug'   => 'Print step-by-step diagnostic output for each user',
        '--weeks'   => 'Look-back window in weeks (default: 1). Use --weeks 4 for testing on older data.',
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

        // Week window: configurable look-back (default 1 week, use --weeks N for testing)
        $weeks     = max(1, (int) (CLI::getOption('weeks') ?? 1));
        $weekEnd   = date('Y-m-d H:i:s');
        $weekStart = date('Y-m-d H:i:s', strtotime("-{$weeks} weeks"));

        $usersModel    = new UsersModel();
        $sendingMail   = new SendingMail();
        $digestService = new DigestService();

        // Resolve user list
        if ($targetUserId !== null) {
            $user = $usersModel->find($targetUserId);
            if (!$user) {
                CLI::error("User not found: {$targetUserId}");
                return;
            }
            $users = [$user];
        } else {
            // Find user_ids that actually have data this week —
            // activity by others on their places OR views in places_views_log.
            // Then intersect with users who have digest enabled.
            $db = \Config\Database::connect();

            $ownerRows = $db->query("
                SELECT DISTINCT p.user_id
                FROM activity a
                JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL
                WHERE a.created_at BETWEEN ? AND ?
                  AND a.type IN ('rating', 'comment', 'photo', 'edit')
                  AND a.deleted_at IS NULL
                  AND a.user_id != p.user_id

                UNION

                SELECT DISTINCT p.user_id
                FROM places_views_log pvl
                JOIN places p ON p.id = pvl.place_id AND p.deleted_at IS NULL
                WHERE pvl.view_date BETWEEN DATE(?) AND DATE(?)
            ", [$weekStart, $weekEnd, $weekStart, $weekEnd])->getResultArray();

            $ownerIds = array_column($ownerRows, 'user_id');

            if (empty($ownerIds)) {
                CLI::write('No place activity found for this period. Nothing to send.', 'yellow');
                return;
            }

            $users = $usersModel
                ->whereIn('id', $ownerIds)
                ->where('email IS NOT NULL', null, false)
                ->where('deleted_at IS NULL', null, false)
                ->findAll();

            // Filter out users who unsubscribed from the digest (settings.emailDigest = false).
            // NULL settings means all notifications are enabled by default.
            $users = array_values(array_filter($users, function ($user) {
                return $user->settings->emailDigest ?? true;
            }));
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

            $sections = $digestService->generateForUser($user->id, $weekStart, $weekEnd);

            // Skip if there is no personal data at all — sending only community
            // highlights to someone who was completely inactive makes no sense.
            $hasPersonalData = isset($sections['week_summary']) || isset($sections['place_activity']);
            if (!$hasPersonalData) {
                CLI::write("Skipping {$user->name}: no personal activity data", 'yellow');
                $skipped++;
                continue;
            }

            $locale = $user->locale ?? 'ru';

            // Render the digest body
            $digestHtml = view('email_digest', [
                'userName' => $user->name,
                'sections' => $sections,
                'locale'   => $locale,
            ]);

            // Wrap in the outer email template
            $preheader = $locale === 'en'
                ? 'Your week on Geometki'
                : 'Ваша неделя на Geometki';

            $subject = $locale === 'en'
                ? 'Your week on Geometki'
                : 'Ваша неделя на Geometki';

            $fullMessage = view('email', [
                'message'     => $digestHtml,
                'preheader'   => $preheader,
                'unsubscribe' => 'https://geometki.com/unsubscribe?digest=' . $user->id,
            ]);

            if ($isDryRun) {
                CLI::write("--- Dry run for: {$user->name} ({$user->email}) ---", 'cyan');
                CLI::write('Subject: ' . $subject, 'cyan');
                CLI::write('Sections: ' . implode(', ', array_keys($sections)), 'white');
                CLI::write('Digest preview: ' . substr(strip_tags($digestHtml), 0, 300), 'white');
                CLI::write('');
                continue; // dry-run does not count as queued
            }

            // Insert into the email queue
            $sendingMail->insert([
                'activity_id' => null,
                'status'      => 'created',
                'email'       => $user->email,
                'locale'      => $locale,
                'subject'     => $subject,
                'message'     => $fullMessage,
            ]);

            // Mark the user as having received a digest
            $usersModel->update($user->id, ['digest_sent_at' => date('Y-m-d H:i:s')]);

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
