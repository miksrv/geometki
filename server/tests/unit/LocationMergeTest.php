<?php

use App\Libraries\LocationMerge;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for App\Libraries\LocationMerge::pickPrimary() — "keep old ids for
 * the main record": the duplicate with the most places wins, ties broken by
 * the lowest id. Pure PHP, no DB.
 *
 * @internal
 */
final class LocationMergeTest extends CIUnitTestCase
{
    public function testTheCandidateWithMorePlacesWins(): void
    {
        // Orenburg: id 1 (87 places) vs id 225 (9 places) — id 1 must win.
        $winner = LocationMerge::pickPrimary([
            ['id' => 1, 'places_count' => 87],
            ['id' => 225, 'places_count' => 9],
        ]);

        $this->assertSame(1, $winner);
    }

    public function testOrderOfCandidatesDoesNotMatter(): void
    {
        $winner = LocationMerge::pickPrimary([
            ['id' => 225, 'places_count' => 9],
            ['id' => 1, 'places_count' => 87],
        ]);

        $this->assertSame(1, $winner);
    }

    public function testTiedPlaceCountsAreBrokenByTheLowestId(): void
    {
        $winner = LocationMerge::pickPrimary([
            ['id' => 50, 'places_count' => 10],
            ['id' => 12, 'places_count' => 10],
        ]);

        $this->assertSame(12, $winner);
    }

    public function testSingleCandidateWins(): void
    {
        $this->assertSame(7, LocationMerge::pickPrimary([['id' => 7, 'places_count' => 0]]));
    }

    public function testEmptyListReturnsNull(): void
    {
        $this->assertNull(LocationMerge::pickPrimary([]));
    }

    public function testThreeWayGroupPicksTheLargest(): void
    {
        // Krasnodar Krai-style three-way split
        $winner = LocationMerge::pickPrimary([
            ['id' => 20, 'places_count' => 56],
            ['id' => 89, 'places_count' => 1],
            ['id' => 140, 'places_count' => 3],
        ]);

        $this->assertSame(20, $winner);
    }

    // -------------------------------------------------------------------------
    // sortByPriority() — the same rule, exposed as a full ordering
    // -------------------------------------------------------------------------

    public function testSortByPriorityOrdersMostPlacesFirst(): void
    {
        $sorted = LocationMerge::sortByPriority([
            ['id' => 225, 'places_count' => 9],
            ['id' => 1, 'places_count' => 87],
        ]);

        $this->assertSame([1, 225], array_column($sorted, 'id'));
    }

    public function testSortByPriorityBreaksTiesByLowestId(): void
    {
        $sorted = LocationMerge::sortByPriority([
            ['id' => 50, 'places_count' => 10],
            ['id' => 12, 'places_count' => 10],
        ]);

        $this->assertSame([12, 50], array_column($sorted, 'id'));
    }

    public function testFirstEntryOfSortByPriorityMatchesPickPrimary(): void
    {
        $candidates = [
            ['id' => 89, 'places_count' => 1],
            ['id' => 20, 'places_count' => 56],
            ['id' => 140, 'places_count' => 3],
        ];

        $this->assertSame(LocationMerge::pickPrimary($candidates), LocationMerge::sortByPriority($candidates)[0]['id']);
    }
}
