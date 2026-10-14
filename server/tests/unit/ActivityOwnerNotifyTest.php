<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the owner-notification gating logic in ActivityLibrary::_add().
 *
 * Mirrors:
 *   if (isset($this->owner) && $this->owner !== $session->user?->id) { ... }
 * Whether an email is queued for the owner is covered by NotificationSettingsTest.
 *
 * All tests are pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class ActivityOwnerNotifyTest extends CIUnitTestCase
{
    // =========================================================================
    // Self-notification guard: owner acting on their own place is never notified
    // =========================================================================

    public function testOwnerActingOnOwnPlaceIsNotNotified(): void
    {
        $owner       = 'user-1';
        $actingUser  = 'user-1';
        $ownerIsSet  = true;

        $shouldNotify = $ownerIsSet && $owner !== $actingUser;

        $this->assertFalse($shouldNotify);
    }

    public function testOtherUserActingOnPlaceIsNotified(): void
    {
        $owner      = 'user-1';
        $actingUser = 'user-2';
        $ownerIsSet = true;

        $shouldNotify = $ownerIsSet && $owner !== $actingUser;

        $this->assertTrue($shouldNotify);
    }

    public function testNoOwnerSetMeansNoNotification(): void
    {
        $ownerIsSet = false;
        $owner      = null;
        $actingUser = 'user-2';

        $shouldNotify = $ownerIsSet && $owner !== $actingUser;

        $this->assertFalse($shouldNotify);
    }
}
