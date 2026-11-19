<?php

use App\Libraries\CronSchedule;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class CronScheduleTest extends CIUnitTestCase
{
    private DateTimeZone $tz;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tz = new DateTimeZone('Europe/Moscow');
    }

    private function at(string $moscow): int
    {
        return (new DateTimeImmutable($moscow, $this->tz))->getTimestamp();
    }

    public function testParsesEverySetting(): void
    {
        $this->assertSame(['kind' => 'every', 'seconds' => 1200], CronSchedule::parse('20m'));
        $this->assertSame(['kind' => 'every', 'seconds' => 43200], CronSchedule::parse(' 12H '));
        $this->assertSame(['kind' => 'every', 'seconds' => 86400], CronSchedule::parse('1d'));
        $this->assertSame(['kind' => 'at', 'hour' => 9, 'minute' => 0, 'day' => null], CronSchedule::parse('09:00'));
        $this->assertSame(['kind' => 'at', 'hour' => 0, 'minute' => 5, 'day' => 1], CronSchedule::parse('mon 0:05'));
        $this->assertSame(['kind' => 'off'], CronSchedule::parse('off'));
        $this->assertSame(['kind' => 'off'], CronSchedule::parse(''));
    }

    public function testRejectsWrongSettings(): void
    {
        foreach (['0m', '20', '25:00', '9:60', 'monday 09:00', 'every 5m'] as $wrong) {
            try {
                CronSchedule::parse($wrong);
                $this->fail("Accepted: {$wrong}");
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function testAnIntervalIsDueOnceItPassed(): void
    {
        $every = CronSchedule::parse('20m');
        $now   = $this->at('2026-11-18 12:00');

        $this->assertTrue(CronSchedule::isDue($every, null, $now, $this->tz));
        $this->assertFalse(CronSchedule::isDue($every, $now - 15 * 60, $now, $this->tz));
        // A tick a few seconds early still counts
        $this->assertTrue(CronSchedule::isDue($every, $now - 20 * 60 + 30, $now, $this->tz));
        $this->assertSame($now - 15 * 60 + 1200, CronSchedule::next($every, $now - 15 * 60, $now, $this->tz));
    }

    public function testAnIntervalShorterThanTheTickRunsEveryTick(): void
    {
        $every = CronSchedule::parse('1m');
        $now   = $this->at('2026-11-18 12:00');

        $this->assertTrue(CronSchedule::isDue($every, $now - 5 * 60, $now, $this->tz));
    }

    public function testADailyTimeRunsOnTheFirstTickAfterIt(): void
    {
        $daily = CronSchedule::parse('00:05');

        // Last ran yesterday after its time: due after 00:05 Moscow today, not before
        $last = $this->at('2026-11-17 00:07');
        $this->assertFalse(CronSchedule::isDue($daily, $last, $this->at('2026-11-18 00:03'), $this->tz));
        $this->assertTrue(CronSchedule::isDue($daily, $last, $this->at('2026-11-18 00:06'), $this->tz));
        // Ran today: not again
        $this->assertFalse(CronSchedule::isDue($daily, $this->at('2026-11-18 00:06'), $this->at('2026-11-18 23:55'), $this->tz));
        $this->assertSame($this->at('2026-11-19 00:05'), CronSchedule::next($daily, $this->at('2026-11-18 00:06'), $this->at('2026-11-18 10:00'), $this->tz));
    }

    public function testAWeeklyTimeRunsOnItsDay(): void
    {
        $weekly = CronSchedule::parse('mon 09:00');
        $last   = $this->at('2026-11-09 09:05'); // Monday

        $this->assertFalse(CronSchedule::isDue($weekly, $last, $this->at('2026-11-15 23:00'), $this->tz)); // Sunday
        $this->assertFalse(CronSchedule::isDue($weekly, $last, $this->at('2026-11-16 08:55'), $this->tz)); // Monday, before
        $this->assertTrue(CronSchedule::isDue($weekly, $last, $this->at('2026-11-16 09:00'), $this->tz));
        // Missed for days (the cron stopped): one run after it comes back
        $this->assertTrue(CronSchedule::isDue($weekly, $last, $this->at('2026-11-18 12:00'), $this->tz));
        $this->assertSame($this->at('2026-11-23 09:00'), CronSchedule::next($weekly, $this->at('2026-11-18 12:00'), $this->at('2026-11-18 12:05'), $this->tz));
    }

    public function testATimedJobNeverStartedWaitsForItsTime(): void
    {
        $weekly = CronSchedule::parse('mon 09:00');
        $now    = $this->at('2026-11-18 12:00'); // Wednesday

        $this->assertFalse(CronSchedule::isDue($weekly, null, $now, $this->tz));
        $this->assertSame($this->at('2026-11-23 09:00'), CronSchedule::next($weekly, null, $now, $this->tz));
    }

    public function testOffNeverRuns(): void
    {
        $off = CronSchedule::parse('off');

        $this->assertFalse(CronSchedule::isDue($off, null, time(), $this->tz));
        $this->assertNull(CronSchedule::next($off, null, time(), $this->tz));
        $this->assertNull(CronSchedule::minutes('off'));
        $this->assertNull(CronSchedule::minutes('mon 09:00'));
        $this->assertNull(CronSchedule::minutes('garbage'));
        $this->assertSame(20, CronSchedule::minutes('20m'));
    }
}
