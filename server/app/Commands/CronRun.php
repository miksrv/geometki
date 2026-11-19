<?php

namespace App\Commands;

use App\Libraries\CronSchedule;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Cron;
use DateTimeZone;
use InvalidArgumentException;
use Throwable;

/**
 * The one cron job of the server: starts the jobs of Config\Cron that are due, one after
 * another in this process. Each job is an ordinary command, run by hand the same way.
 *
 *   cd server
 *   php spark cron:run           # start what is due (cron, every 5 minutes)
 *   php spark cron:run --list    # the schedule: when each job ran and runs next, changes nothing
 *
 * The cron of the hosting:
 *   *\/5 * * * * cd /path/to/server && php spark cron:run >> /dev/null 2>&1
 *
 * The last start of each job is kept in writable/cron/state.json. A job still running (a lock
 * of its own, writable/cron/<job>.lock) is skipped, so a run that takes longer than the tick
 * never doubles; the other jobs go on. A failing job is logged and does not stop the rest.
 */
class CronRun extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'cron:run';
    protected $description = 'The one cron job: start the jobs of Config\Cron that are due';
    protected $usage       = 'cron:run [--list]';
    protected $options     = [
        '--list' => 'Show the schedule (last and next start of each job), start nothing',
    ];

    private string $dir;

    public function run(array $params)
    {
        $config    = config(Cron::class);
        $tz        = new DateTimeZone($config->timezone);
        $this->dir = WRITEPATH . 'cron' . DIRECTORY_SEPARATOR;

        if (!is_dir($this->dir)) {
            mkdir($this->dir, 0755, true);
        }

        if (array_key_exists('list', $params) || CLI::getOption('list') !== null) {
            $this->list($config, $tz);

            return EXIT_SUCCESS;
        }

        $failed = false;

        foreach ($config->jobs as $job => $command) {
            try {
                $schedule = CronSchedule::parse((string) ($config->{$job} ?? 'off'));
            } catch (InvalidArgumentException $e) {
                log_message('error', "[Cron] {$job}: {message}", ['message' => $e->getMessage()]);
                CLI::error("{$job}: " . $e->getMessage());
                $failed = true;

                continue;
            }

            $now  = time();
            $last = $this->state()[$job]['started'] ?? null;

            // A timed job seen for the first time waits for its next time (CronSchedule::isDue())
            if ($last === null && $schedule['kind'] === 'at') {
                $this->save($job, ['started' => $now, 'status' => 'seen']);

                continue;
            }

            if (!CronSchedule::isDue($schedule, $last, $now, $tz)) {
                continue;
            }

            $failed = !$this->start($job, $command) || $failed;
        }

        return $failed ? EXIT_ERROR : EXIT_SUCCESS;
    }

    /** One job under its lock; false when it failed */
    private function start(string $job, string $command): bool
    {
        $lock = fopen($this->dir . $job . '.lock', 'c');

        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            CLI::write("{$job}: still running, skipped", 'yellow');

            return true;
        }

        $started = time();
        $timer   = microtime(true);

        $this->save($job, ['started' => $started, 'status' => 'running']);
        CLI::write("{$job}: {$command}", 'yellow');

        try {
            $code = service('commands')->run($command, []);
            $ok   = $code === null || $code === EXIT_SUCCESS;
        } catch (Throwable $e) {
            log_message('error', "[Cron] {$job} ({$command}): {exception}", ['exception' => $e]);
            CLI::error("{$job}: " . $e->getMessage());
            $ok = false;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }

        $this->save($job, [
            'started'  => $started,
            'finished' => time(),
            'seconds'  => round(microtime(true) - $timer, 1),
            'status'   => $ok ? 'ok' : 'error',
        ]);

        return $ok;
    }

    private function list(Cron $config, DateTimeZone $tz): void
    {
        $state = $this->state();
        $now   = time();
        $time  = static fn (?int $at) => $at === null ? '—' : date_create('@' . $at)->setTimezone($tz)->format('d.m H:i');
        $rows  = [];

        foreach ($config->jobs as $job => $command) {
            $when  = (string) ($config->{$job} ?? 'off');
            $last  = $state[$job] ?? [];
            $start = $last['status'] ?? null;
            $start = $start === 'seen' ? null : ($last['started'] ?? null);

            try {
                $schedule = CronSchedule::parse($when);
                $next     = CronSchedule::next($schedule, $last['started'] ?? null, $now, $tz);
                $next     = $next === null ? 'off' : ($next <= $now ? 'now' : $time($next));
            } catch (InvalidArgumentException) {
                $next = 'wrong setting';
            }

            $rows[] = [
                $job,
                $command,
                $when,
                $time($start),
                isset($last['seconds']) && $start !== null ? $last['seconds'] . ' s' : '—',
                $start !== null ? ($last['status'] ?? '—') : '—',
                $next,
            ];
        }

        CLI::table($rows, ['Job', 'Command', 'When', 'Last start', 'Took', 'Result', 'Next']);
        CLI::write("Times: {$config->timezone}. The cron runs cron:run every {$config->tick} min.");
    }

    /** @return array<string, array{started?: int, finished?: int, seconds?: float, status?: string}> */
    private function state(): array
    {
        $raw = @file_get_contents($this->dir . 'state.json');

        return is_string($raw) && is_array($data = json_decode($raw, true)) ? $data : [];
    }

    /** One job's entry, read and written under a lock: two runs may overlap */
    private function save(string $job, array $entry): void
    {
        $file = fopen($this->dir . 'state.json', 'c+');

        if ($file === false) {
            log_message('error', '[Cron] writable/cron/state.json cannot be opened');

            return;
        }

        try {
            flock($file, LOCK_EX);
            $raw   = stream_get_contents($file);
            $state = is_string($raw) && is_array($data = json_decode($raw, true)) ? $data : [];

            $state[$job] = $entry;

            ftruncate($file, 0);
            rewind($file);
            fwrite($file, json_encode($state, JSON_PRETTY_PRINT));
            fflush($file);
        } finally {
            flock($file, LOCK_UN);
            fclose($file);
        }
    }
}
