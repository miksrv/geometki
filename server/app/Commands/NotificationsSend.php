<?php

/**
 * Delivers notifications outside the site and keeps their queues small: the
 * one notification job for cron.
 *   - sends a batch of the email queue (activity notifications, weekly digests;
 *     an email skips the events a push already told about and waits for a queued one);
 *   - sends a batch of the push queue;
 *   - deletes the guest cache folders cleared since the last run (Config\GuestCache);
 *   - once a day deletes queue rows older than Config\Notifications::$retentionDays,
 *     push devices that keep failing and stale guest cache answers.
 *
 * Run from CLI:
 *   php spark notifications:send
 *   php spark notifications:send --cleanup   # clean up now, not only once a day
 *
 * Add to cron (every minute; overlapping runs are safe):
 *   * * * * * cd /path/to/server && php spark notifications:send >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Libraries\GuestCache;
use App\Libraries\Mail\MailQueue;
use App\Libraries\Push\PushQueue;
use App\Models\SendingMail;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Throwable;

class NotificationsSend extends BaseCommand
{
    protected $group       = 'notifications';
    protected $name        = 'notifications:send';
    protected $description = 'Send queued notifications (push, email) and clean up old queue rows once a day';
    protected $usage       = 'notifications:send [--cleanup]';
    protected $options     = [
        '--cleanup' => 'Delete old queue rows now instead of waiting for the daily cleanup',
    ];

    /** Cache key of the last cleanup; the cleanup runs when it has expired */
    private const CLEANUP_CACHE_KEY = 'notifications_cleanup';
    private const CLEANUP_INTERVAL  = DAY;

    public function run(array $params)
    {
        // Each stage on its own: a failing one (a push service down, a missing table) must
        // not keep the others from running. Emails first: they never wait for the push
        // services; an email about an event whose push is still queued waits by itself.
        $failed = false;

        foreach ([
            'email'   => fn () => $this->sendEmails(),
            'push'    => fn () => $this->sendPushes(),
            'cleanup' => fn () => $this->cleanup(CLI::getOption('cleanup') !== null),
            // Every run: a busy day clears the guest cache many times, each leaving a folder
            'guest cache' => fn () => (new GuestCache())->sweep(),
        ] as $stage => $run) {
            try {
                $run();
            } catch (Throwable $e) {
                $failed = true;
                CLI::error("The {$stage} stage failed: " . $e->getMessage());
                log_message('critical', '[notifications:send] {stage}: {exception}', ['stage' => $stage, 'exception' => $e]);
            }
        }

        return $failed ? EXIT_ERROR : EXIT_SUCCESS;
    }

    private function sendPushes(): void
    {
        $queue = new PushQueue();

        $stats = $queue->process(static function (string $line, string $color = 'white'): void {
            CLI::write($line, $color);
        });

        // Push not set up: process() only expired what was queued before
        if (!$queue->isConfigured()) {
            return;
        }

        CLI::write('Push queue processed.', 'green');
        $this->writeStats($stats);
    }

    private function sendEmails(): void
    {
        $stats = (new MailQueue())->process(static function (string $line, string $color = 'white'): void {
            CLI::write($line, $color);
        });

        CLI::write('Email queue processed.', 'green');
        $this->writeStats($stats);
    }

    private function writeStats(array $stats): void
    {
        CLI::write('  Sent:     ' . $stats['sent'] . ($stats['grouped'] ? " (+{$stats['grouped']} grouped into them)" : ''), 'green');
        CLI::write('  Deferred: ' . $stats['deferred'], 'white');
        CLI::write('  Rejected: ' . $stats['rejected'], $stats['rejected'] ? 'yellow' : 'white');
        CLI::write('  Failed:   ' . $stats['failed'], $stats['failed'] ? 'red' : 'white');
        CLI::write('  Expired:  ' . $stats['expired'], $stats['expired'] ? 'yellow' : 'white');
    }

    /**
     * Once a day (or now, with --cleanup): delete queue rows past the retention period
     * and push devices that keep failing.
     */
    private function cleanup(bool $force): void
    {
        if (!$force && cache(self::CLEANUP_CACHE_KEY)) {
            return;
        }

        $days    = config('Notifications')->retentionDays;
        $deleted = (new SendingMail())->purgeOlderThan($days);
        $push    = (new PushQueue())->cleanup();
        $guest   = (new GuestCache())->prune();

        // Marked done only now: a failed cleanup is tried again next minute
        cache()->save(self::CLEANUP_CACHE_KEY, time(), self::CLEANUP_INTERVAL);

        CLI::write("Cleanup: deleted {$deleted} emails and {$push['messages']} pushes older than {$days} days, {$push['subscriptions']} failing push devices, {$push['expired']} expired ones, {$guest} stale guest cache answers.", 'green');
    }
}
