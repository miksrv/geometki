<?php

use App\Models\PlacesContentModel;
use CodeIgniter\I18n\Time;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for PlacesContentModel::isSameEditSession(): an edit updates the
 * last revision of a place text only when it comes from the same signed-in
 * author within 24 hours of that revision's start. Pure PHP, no DB.
 *
 * @internal
 */
final class PlacesContentRevisionWindowTest extends CIUnitTestCase
{
    private Time $now;

    protected function setUp(): void
    {
        parent::setUp();

        $this->now = Time::parse('2026-10-13 12:00:00');
    }

    public function testSameAuthorWithinWindowMerges(): void
    {
        $this->assertTrue(PlacesContentModel::isSameEditSession('u1', '2026-10-13 09:00:00', 'u1', $this->now));
    }

    public function testSameAuthorJustBeforeWindowEndMerges(): void
    {
        $this->assertTrue(PlacesContentModel::isSameEditSession('u1', '2026-10-12 12:00:01', 'u1', $this->now));
    }

    public function testSameAuthorAfterWindowStartsNewRevision(): void
    {
        $this->assertFalse(PlacesContentModel::isSameEditSession('u1', '2026-10-12 12:00:00', 'u1', $this->now));
    }

    public function testOtherAuthorStartsNewRevision(): void
    {
        $this->assertFalse(PlacesContentModel::isSameEditSession('u1', '2026-10-13 11:59:00', 'u2', $this->now));
    }

    public function testAnonymousEditsNeverMerge(): void
    {
        $this->assertFalse(PlacesContentModel::isSameEditSession(null, '2026-10-13 11:59:00', null, $this->now));
        $this->assertFalse(PlacesContentModel::isSameEditSession('', '2026-10-13 11:59:00', '', $this->now));
    }

    public function testAcceptsTimeInstance(): void
    {
        $this->assertTrue(PlacesContentModel::isSameEditSession('u1', Time::parse('2026-10-13 11:00:00'), 'u1', $this->now));
    }

    public function testMissingRevisionDateStartsNewRevision(): void
    {
        $this->assertFalse(PlacesContentModel::isSameEditSession('u1', null, 'u1', $this->now));
    }
}
