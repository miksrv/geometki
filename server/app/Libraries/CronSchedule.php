<?php

namespace App\Libraries;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * When a job of `cron:run` is due (Config\Cron): the settings `5m` / `12h` / `1d` (an interval),
 * `09:00` (every day) and `mon 09:00` (every week), `off`. Pure functions of the setting, the
 * last start and the clock.
 */
final class CronSchedule
{
    private const DAYS = ['mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6, 'sun' => 7];
    private const UNITS = ['m' => 60, 'h' => 3600, 'd' => 86400];

    /** A tick may come a little early (cron starts at the minute, the jobs before take time) */
    private const EARLY = 60;

    /**
     * @return array{kind: 'off'}|array{kind: 'every', seconds: int}|array{kind: 'at', hour: int, minute: int, day: int|null}
     * @throws InvalidArgumentException a setting that is none of these
     */
    public static function parse(string $when): array
    {
        $when = strtolower(trim($when));

        if ($when === 'off' || $when === '0' || $when === '') {
            return ['kind' => 'off'];
        }

        if (preg_match('/^(\d+)\s*([mhd])$/', $when, $m) && (int) $m[1] > 0) {
            return ['kind' => 'every', 'seconds' => (int) $m[1] * self::UNITS[$m[2]]];
        }

        if (preg_match('/^(?:(mon|tue|wed|thu|fri|sat|sun)\s+)?(\d{1,2}):(\d{2})$/', $when, $m)
            && (int) $m[2] < 24 && (int) $m[3] < 60) {
            return [
                'kind'   => 'at',
                'hour'   => (int) $m[2],
                'minute' => (int) $m[3],
                'day'    => $m[1] !== '' ? self::DAYS[$m[1]] : null,
            ];
        }

        throw new InvalidArgumentException("Not a schedule: \"{$when}\" (use 20m, 12h, 1d, 09:00, mon 09:00 or off)");
    }

    /**
     * Whether the job is to start now. A timed job never started is not due: it waits for its
     * next time rather than catching up at once (no weekly digest on the day of a deploy) —
     * the caller marks such a job as seen (`$lastStart` = now).
     */
    public static function isDue(array $schedule, ?int $lastStart, int $now, DateTimeZone $tz): bool
    {
        return match ($schedule['kind']) {
            'every' => $lastStart === null || $now - $lastStart >= $schedule['seconds'] - self::EARLY,
            'at'    => $lastStart !== null && $lastStart < self::lastSlot($schedule, $now, $tz),
            default => false,
        };
    }

    /** When it starts next (now when it is due), null when it is off */
    public static function next(array $schedule, ?int $lastStart, int $now, DateTimeZone $tz): ?int
    {
        if ($schedule['kind'] === 'off') {
            return null;
        }

        if (self::isDue($schedule, $lastStart, $now, $tz)) {
            return $now;
        }

        if ($schedule['kind'] === 'every') {
            return $lastStart + $schedule['seconds'];
        }

        return (new DateTimeImmutable('@' . self::lastSlot($schedule, $now, $tz)))
            ->setTimezone($tz)
            ->modify($schedule['day'] ? '+7 days' : '+1 day')
            ->getTimestamp();
    }

    /** The interval in minutes, null for a timed job or one turned off */
    public static function minutes(string $when): ?int
    {
        try {
            $schedule = self::parse($when);
        } catch (InvalidArgumentException) {
            return null;
        }

        return $schedule['kind'] === 'every' ? intdiv($schedule['seconds'], 60) : null;
    }

    /** The latest moment of a timed job's time (the day and the time) that is not after now */
    public static function lastSlot(array $schedule, int $now, DateTimeZone $tz): int
    {
        $today = (new DateTimeImmutable('@' . $now))->setTimezone($tz);
        $slot  = $today->setTime($schedule['hour'], $schedule['minute']);

        if ($schedule['day']) {
            $back = ((int) $today->format('N') - $schedule['day'] + 7) % 7;
            $slot = $slot->modify("-{$back} days");
        }

        if ($slot->getTimestamp() > $now) {
            $slot = $slot->modify($schedule['day'] ? '-7 days' : '-1 day');
        }

        return $slot->getTimestamp();
    }
}
