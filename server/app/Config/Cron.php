<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The jobs of the server and when `php spark cron:run` starts them: the hosting runs only that
 * one command, every few minutes (`$tick`), and it starts the jobs that are due. Each job is
 * still an ordinary command, run by hand the same way (`php spark notifications:send`).
 *
 * When a job runs, one of:
 *  - an interval: `5m`, `20m`, `1h`, `12h`, `1d` — once this long has passed since its last
 *    start (an interval shorter than the tick means every tick);
 *  - a time of day: `09:00` — every day, on the first tick after it;
 *  - a day and a time: `mon 09:00` — every week (`mon` … `sun`);
 *  - `off` — never by `cron:run`.
 * The times are in `$timezone`. A job that is still running when its time comes again is
 * skipped, so a long run never doubles.
 *
 * Each one can be changed in `.env` without a deploy of code, e.g.
 *   cron.notifications = 20m
 *   cron.digest        = "tue 10:00"   (a value with a space in quotes, or .env fails to load)
 */
class Cron extends BaseConfig
{
    /** How often the hosting runs `cron:run`, in minutes (for `cron:run --list` and the checks) */
    public int $tick = 5;

    /** The time zone of the times of day: the game's days are Moscow days too */
    public string $timezone = 'Europe/Moscow';

    /** `notifications:send`: the email and push queues, the daily cleanup */
    public string $notifications = '5m';

    /** `osm:collect`: OSM candidates (white spots) for the queued tiles, from Overpass */
    public string $osm = '20m';

    /** `places:outlines`: the OSM outlines of new large places (the game's "near"), from Overpass */
    public string $outlines = '20m';

    /** `trending:refresh`: the trending scores of the places */
    public string $trending = '1h';

    /** `digest:weekly`: the weekly digest emails */
    public string $digest = 'mon 09:00';

    /** `game:tick`: closes the seasons that are over (a season's days are Moscow days) */
    public string $game = '00:05';

    /**
     * The jobs in the order of a run: the setting above => its command. A job is added here and
     * as a property above.
     *
     * @var array<string, string>
     */
    public array $jobs = [
        'notifications' => 'notifications:send',
        'game'          => 'game:tick',
        'trending'      => 'trending:refresh',
        'digest'        => 'digest:weekly',
        'osm'           => 'osm:collect',
        'outlines'      => 'places:outlines',
    ];
}
