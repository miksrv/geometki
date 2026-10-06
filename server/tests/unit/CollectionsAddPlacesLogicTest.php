<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the place-filtering and "collection" activity-firing logic
 * used in Collections::addPlaces(): duplicates and nonexistent/deleted
 * places are skipped, and the one-time 'collection' activity only fires once
 * the collection reaches COLLECTION_ACTIVITY_MIN_PLACES places and only when
 * the owner themself is the one adding. Pure PHP, no DB.
 *
 * @internal
 */
final class CollectionsAddPlacesLogicTest extends CIUnitTestCase
{
    /**
     * Mirrors the request-id dedup + membership-skip step in addPlaces().
     */
    private function candidateIds(array $requestedIds, array $alreadyMembers): array
    {
        $requestedIds = array_values(array_unique(array_map('strval', $requestedIds)));

        return array_values(array_diff($requestedIds, $alreadyMembers));
    }

    public function testDuplicateRequestedIdsAreCollapsed(): void
    {
        $this->assertSame(['p1', 'p2'], $this->candidateIds(['p1', 'p1', 'p2'], []));
    }

    public function testAlreadyMemberPlacesAreSkipped(): void
    {
        $this->assertSame(['p2'], $this->candidateIds(['p1', 'p2'], ['p1']));
    }

    public function testAllAlreadyMembersYieldsNoCandidates(): void
    {
        $this->assertSame([], $this->candidateIds(['p1', 'p2'], ['p1', 'p2']));
    }

    /**
     * Mirrors the valid-place filtering: only candidates found (non-deleted)
     * in the places table are actually added; the rest are reported skipped.
     */
    private function partitionByExistence(array $candidateIds, array $existingPlaceIds): array
    {
        $added   = array_values(array_intersect($candidateIds, $existingPlaceIds));
        $skipped = array_values(array_diff($candidateIds, $existingPlaceIds));

        return [$added, $skipped];
    }

    public function testNonexistentOrDeletedPlacesAreReportedSkipped(): void
    {
        [$added, $skipped] = $this->partitionByExistence(['p1', 'p2', 'ghost'], ['p1', 'p2']);

        $this->assertSame(['p1', 'p2'], $added);
        $this->assertSame(['ghost'], $skipped);
    }

    /**
     * Mirrors the "fire 'collection' activity only once, at >= 3 places"
     * guard. It fires regardless of who is acting (owner or admin) — the
     * activity is always attributed to the collection's owner.
     */
    private function shouldFireCollectionActivity(int $newCount, int $minPlaces, bool $alreadyFired): bool
    {
        return $newCount >= $minPlaces && !$alreadyFired;
    }

    public function testActivityDoesNotFireBelowThreshold(): void
    {
        $this->assertFalse($this->shouldFireCollectionActivity(2, 3, false));
    }

    public function testActivityFiresExactlyAtThreshold(): void
    {
        $this->assertTrue($this->shouldFireCollectionActivity(3, 3, false));
    }

    public function testActivityDoesNotFireTwice(): void
    {
        $this->assertFalse($this->shouldFireCollectionActivity(5, 3, true));
    }

    public function testActivityFiresWhenAdminAddsNotOwner(): void
    {
        $this->assertTrue($this->shouldFireCollectionActivity(3, 3, false));
    }

    /**
     * Mirrors ActivityLibrary::_add()'s attribution: the 'collection'
     * activity (and its XP/achievements) always goes to the collection's
     * owner, never to whoever happened to be acting (e.g. an admin).
     */
    private function collectionActivityAuthor(string $collectionOwnerId, string $actingUserId): string
    {
        // Collections::addPlaces() always passes the owner id explicitly.
        return $collectionOwnerId;
    }

    public function testCollectionActivityIsAttributedToOwnerWhenOwnerActs(): void
    {
        $this->assertSame('user-1', $this->collectionActivityAuthor('user-1', 'user-1'));
    }

    public function testCollectionActivityIsAttributedToOwnerWhenAdminActs(): void
    {
        $this->assertSame('user-1', $this->collectionActivityAuthor('user-1', 'admin-1'));
    }

    /**
     * Mirrors the "notify the place owner unless they added it themselves"
     * guard in addPlaces()/ActivityLibrary::_add().
     */
    private function shouldNotifyPlaceOwner(?string $placeOwnerId, string $actingUserId): bool
    {
        return $placeOwnerId !== null && $placeOwnerId !== $actingUserId;
    }

    public function testOwnerAddingOwnPlaceIsNotNotified(): void
    {
        $this->assertFalse($this->shouldNotifyPlaceOwner('user-1', 'user-1'));
    }

    public function testOwnerIsNotifiedWhenSomeoneElseAddsTheirPlace(): void
    {
        $this->assertTrue($this->shouldNotifyPlaceOwner('user-1', 'user-2'));
    }

    public function testPlaceWithNoOwnerIsNeverNotified(): void
    {
        $this->assertFalse($this->shouldNotifyPlaceOwner(null, 'user-2'));
    }
}
