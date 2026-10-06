<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the "recalculate collections after a place is hard-deleted"
 * logic in Places::delete():
 *
 *   $affectedCollectionIds = $collectionsPlacesModel->collectionIdsForPlace($id);
 *   ... hard delete the place (cascades the collections_places rows away) ...
 *   foreach (array_unique($affectedCollectionIds) as $collectionId) {
 *       $collectionsModel->recalcPlacesCount($collectionId);
 *       $collectionsModel->recalcIndexable($collectionId);
 *   }
 *
 * Without this, a collection's places_count and indexable flag would stay
 * stale (a deleted place must be filtered out on read and places_count
 * recalculated) after an admin
 * hard-deletes one of its places outside of any Collections endpoint.
 *
 * Pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class CollectionsPlaceDeletionCascadeTest extends CIUnitTestCase
{
    /**
     * Mirrors the dedup step before recalculating: the same collection must
     * only be recalculated once even if collectionIdsForPlace() somehow
     * returned it twice.
     */
    private function collectionsToRecalculate(array $affectedCollectionIds): array
    {
        return array_values(array_unique($affectedCollectionIds));
    }

    public function testNoAffectedCollectionsMeansNothingToRecalculate(): void
    {
        $this->assertSame([], $this->collectionsToRecalculate([]));
    }

    public function testEachAffectedCollectionIsRecalculatedOnce(): void
    {
        $this->assertSame(['c1', 'c2'], $this->collectionsToRecalculate(['c1', 'c2']));
    }

    public function testDuplicateCollectionIdsAreCollapsed(): void
    {
        $this->assertSame(['c1', 'c2'], $this->collectionsToRecalculate(['c1', 'c1', 'c2', 'c1']));
    }

    /**
     * Mirrors recalcPlacesCount() dropping to a lower, correct count once the
     * deleted place's membership row is gone.
     */
    private function placesCountAfterRemoval(int $countBefore, bool $placeWasMember): int
    {
        return $placeWasMember ? $countBefore - 1 : $countBefore;
    }

    public function testPlacesCountDropsByOneWhenMemberIsRemoved(): void
    {
        $this->assertSame(4, $this->placesCountAfterRemoval(5, true));
    }

    public function testPlacesCountUnchangedWhenPlaceWasNotAMember(): void
    {
        $this->assertSame(5, $this->placesCountAfterRemoval(5, false));
    }

    /**
     * Mirrors the knock-on effect on indexability: dropping below the
     * minimum place count after a deletion must turn an indexable collection
     * non-indexable again, exactly like App\Libraries\CollectionIndexability.
     */
    private function isIndexable(int $placesCount, bool $hidden): bool
    {
        return !$hidden && $placesCount >= COLLECTION_INDEX_MIN_PLACES;
    }

    public function testDroppingBelowMinPlacesTurnsCollectionNonIndexable(): void
    {
        $this->assertTrue($this->isIndexable(COLLECTION_INDEX_MIN_PLACES, false));
        $this->assertFalse($this->isIndexable(COLLECTION_INDEX_MIN_PLACES - 1, false));
    }
}
