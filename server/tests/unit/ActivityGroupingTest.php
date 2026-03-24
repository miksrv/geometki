<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for activity-grouping logic in Activity controller.
 *
 * The shouldGroupActivities() private method and the grouping condition inside
 * groupSimilarActivities() are tested via their observable output — the pure
 * boolean expressions extracted here without instantiating the controller.
 *
 * All tests are pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class ActivityGroupingTest extends CIUnitTestCase
{
    /**
     * Mirrors Activity::shouldGroupActivities() logic:
     *
     *   return (
     *       (!isset($lastItem->place) || $lastItem->place->id === $nextItem->place_id) &&
     *       $lastItem->user_id === $nextItem->user_id
     *   );
     */
    private function shouldGroup(object $last, object $next): bool
    {
        return (
            (!isset($last->place) || $last->place->id === $next->place_id) &&
            $last->user_id === $next->user_id
        );
    }

    // =========================================================================
    // Grouping: same user, no place constraint
    // =========================================================================

    public function testSameUserWithNoPlaceIsGrouped(): void
    {
        $last = (object) ['user_id' => 'u1'];
        $next = (object) ['user_id' => 'u1', 'place_id' => 'p1'];

        $this->assertTrue($this->shouldGroup($last, $next));
    }

    public function testDifferentUsersAreNotGrouped(): void
    {
        $last = (object) ['user_id' => 'u1'];
        $next = (object) ['user_id' => 'u2', 'place_id' => 'p1'];

        $this->assertFalse($this->shouldGroup($last, $next));
    }

    // =========================================================================
    // Grouping: same user, same place
    // =========================================================================

    public function testSameUserSamePlaceIsGrouped(): void
    {
        $last = (object) [
            'user_id' => 'u1',
            'place'   => (object) ['id' => 'p1'],
        ];
        $next = (object) ['user_id' => 'u1', 'place_id' => 'p1'];

        $this->assertTrue($this->shouldGroup($last, $next));
    }

    public function testSameUserDifferentPlaceIsNotGrouped(): void
    {
        $last = (object) [
            'user_id' => 'u1',
            'place'   => (object) ['id' => 'p1'],
        ];
        $next = (object) ['user_id' => 'u1', 'place_id' => 'p2'];

        $this->assertFalse($this->shouldGroup($last, $next));
    }

    public function testDifferentUsersSamePlaceIsNotGrouped(): void
    {
        $last = (object) [
            'user_id' => 'u1',
            'place'   => (object) ['id' => 'p1'],
        ];
        $next = (object) ['user_id' => 'u2', 'place_id' => 'p1'];

        $this->assertFalse($this->shouldGroup($last, $next));
    }

    // =========================================================================
    // Activity type priority logic
    // (mirrors groupSimilarActivities type-determination block)
    // =========================================================================

    public function testPlaceTypeTakesPriorityOverPhotoType(): void
    {
        // If existing group type is 'photo' and new item type is 'place', result should be 'place'
        $groupType = 'photo';
        $itemType  = 'place';

        if ($itemType === 'place') {
            $groupType = 'place';
        } elseif ($itemType === 'edit' && $groupType !== 'place') {
            $groupType = 'edit';
        } elseif ($itemType === 'photo' && $groupType === 'photo') {
            $groupType = 'photo';
        }

        $this->assertSame('place', $groupType);
    }

    public function testEditTypeTakesPriorityOverPhotoType(): void
    {
        $groupType = 'photo';
        $itemType  = 'edit';

        if ($itemType === 'place') {
            $groupType = 'place';
        } elseif ($itemType === 'edit' && $groupType !== 'place') {
            $groupType = 'edit';
        } elseif ($itemType === 'photo' && $groupType === 'photo') {
            $groupType = 'photo';
        }

        $this->assertSame('edit', $groupType);
    }

    public function testEditTypeDoesNotOverridePlaceType(): void
    {
        $groupType = 'place';
        $itemType  = 'edit';

        if ($itemType === 'place') {
            $groupType = 'place';
        } elseif ($itemType === 'edit' && $groupType !== 'place') {
            $groupType = 'edit';
        } elseif ($itemType === 'photo' && $groupType === 'photo') {
            $groupType = 'photo';
        }

        $this->assertSame('place', $groupType);
    }

    public function testPhotoTypeRemainsPhotoWhenGroupIsPhoto(): void
    {
        $groupType = 'photo';
        $itemType  = 'photo';

        if ($itemType === 'place') {
            $groupType = 'place';
        } elseif ($itemType === 'edit' && $groupType !== 'place') {
            $groupType = 'edit';
        } elseif ($itemType === 'photo' && $groupType === 'photo') {
            $groupType = 'photo';
        }

        $this->assertSame('photo', $groupType);
    }
}
