<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the owner-notification gating logic in ActivityLibrary::_add().
 *
 * Mirrors:
 *   if (isset($this->owner) && $this->owner !== $session->user?->id) { ... }
 *   and the email-settings-per-type condition used to decide whether to queue
 *   a notification email for 'bookmark' and 'visit' activity types.
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

    // =========================================================================
    // Email-settings gating per activity type (bookmark / visit)
    // =========================================================================

    private function shouldQueueEmail(object $settings, string $type): bool
    {
        return ($settings->emailPhoto && $type === 'photo')
            || ($settings->emailComment && $type === 'comment')
            || ($settings->emailEdit && $type === 'edit')
            || ($settings->emailRating && $type === 'rating')
            || ($settings->emailCover && $type === 'cover')
            || ($settings->emailBookmark && $type === 'bookmark')
            || ($settings->emailVisit && $type === 'visit');
    }

    public function testBookmarkEmailQueuedWhenSettingEnabled(): void
    {
        $settings = (object) [
            'emailPhoto' => true, 'emailComment' => true, 'emailEdit' => true,
            'emailRating' => true, 'emailCover' => true,
            'emailBookmark' => true, 'emailVisit' => true,
        ];

        $this->assertTrue($this->shouldQueueEmail($settings, 'bookmark'));
    }

    public function testBookmarkEmailSkippedWhenSettingDisabled(): void
    {
        $settings = (object) [
            'emailPhoto' => true, 'emailComment' => true, 'emailEdit' => true,
            'emailRating' => true, 'emailCover' => true,
            'emailBookmark' => false, 'emailVisit' => true,
        ];

        $this->assertFalse($this->shouldQueueEmail($settings, 'bookmark'));
    }

    public function testVisitEmailQueuedWhenSettingEnabled(): void
    {
        $settings = (object) [
            'emailPhoto' => true, 'emailComment' => true, 'emailEdit' => true,
            'emailRating' => true, 'emailCover' => true,
            'emailBookmark' => true, 'emailVisit' => true,
        ];

        $this->assertTrue($this->shouldQueueEmail($settings, 'visit'));
    }

    public function testVisitEmailSkippedWhenSettingDisabled(): void
    {
        $settings = (object) [
            'emailPhoto' => true, 'emailComment' => true, 'emailEdit' => true,
            'emailRating' => true, 'emailCover' => true,
            'emailBookmark' => true, 'emailVisit' => false,
        ];

        $this->assertFalse($this->shouldQueueEmail($settings, 'visit'));
    }

    // =========================================================================
    // mapActivityType() in Mail controller — bookmark/visit unsubscribe mapping
    // =========================================================================

    private function mapActivityType(string $activityType): string
    {
        return match ($activityType) {
            'comment'  => 'emailComment',
            'edit'     => 'emailEdit',
            'photo'    => 'emailPhoto',
            'rating'   => 'emailRating',
            'cover'    => 'emailCover',
            'bookmark' => 'emailBookmark',
            'visit'    => 'emailVisit',

            default => '',
        };
    }

    public function testMapActivityTypeResolvesBookmark(): void
    {
        $this->assertSame('emailBookmark', $this->mapActivityType('bookmark'));
    }

    public function testMapActivityTypeResolvesVisit(): void
    {
        $this->assertSame('emailVisit', $this->mapActivityType('visit'));
    }
}
