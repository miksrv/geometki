<?php

use App\Libraries\SearchPlacesRanking;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class SearchPlacesRankingTest extends CIUnitTestCase
{
    /** Rows in the relevance order */
    private function rows(): array
    {
        return [
            ['id' => 'a', 'category' => 'cave', 'views' => 10, 'rating' => null, 'created_at' => '2026-01-01 00:00:00', 'distance' => 50.5],
            ['id' => 'b', 'category' => 'castle', 'views' => 300, 'rating' => 4.5, 'created_at' => '2026-03-01 00:00:00', 'distance' => 5.2],
            ['id' => 'c', 'category' => 'cave', 'views' => 300, 'rating' => 3.0, 'created_at' => '2025-12-01 00:00:00', 'distance' => null],
            ['id' => 'd', 'category' => 'waterfall', 'views' => 20, 'rating' => 5.0, 'created_at' => '2026-02-01 00:00:00', 'distance' => 12.0],
        ];
    }

    private function ids(array $rows): array
    {
        return array_column($rows, 'id');
    }

    public function testRelevanceAndUnknownSortsKeepOrder(): void
    {
        $this->assertSame(['a', 'b', 'c', 'd'], $this->ids(SearchPlacesRanking::sort($this->rows(), 'relevance')));
        $this->assertSame(['a', 'b', 'c', 'd'], $this->ids(SearchPlacesRanking::sort($this->rows(), 'title')));
        $this->assertSame(['a', 'b', 'c', 'd'], $this->ids(SearchPlacesRanking::sort($this->rows(), null)));
    }

    public function testDistanceIsNearestFirstAndUnknownLast(): void
    {
        $this->assertSame(['b', 'd', 'a', 'c'], $this->ids(SearchPlacesRanking::sort($this->rows(), 'distance')));
    }

    public function testViewsDescendingTiesKeepRelevance(): void
    {
        $this->assertSame(['b', 'c', 'd', 'a'], $this->ids(SearchPlacesRanking::sort($this->rows(), 'views')));
    }

    public function testRatingDescendingUnratedLast(): void
    {
        $this->assertSame(['d', 'b', 'c', 'a'], $this->ids(SearchPlacesRanking::sort($this->rows(), 'rating')));
    }

    public function testCreatedNewestFirst(): void
    {
        $this->assertSame(['b', 'd', 'a', 'c'], $this->ids(SearchPlacesRanking::sort($this->rows(), 'created_at')));
    }

    public function testExplicitOrderWins(): void
    {
        $this->assertSame(['a', 'd', 'b', 'c'], $this->ids(SearchPlacesRanking::sort($this->rows(), 'distance', 'desc')));
    }
}
