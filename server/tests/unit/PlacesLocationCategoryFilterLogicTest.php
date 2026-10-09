<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the pure parsing/mapping logic in Places::makeListFilters()
 * added for the landing-page API: the comma-separated `category` list, and
 * mapping a resolved location slug's type to the places column to filter on.
 * Pure PHP, no DB — mirrors the controller's own conditions.
 *
 * @internal
 */
final class PlacesLocationCategoryFilterLogicTest extends CIUnitTestCase
{
    // -------------------------------------------------------------------------
    // category=a,b,c parsing
    // -------------------------------------------------------------------------

    /**
     * Mirrors: array_values(array_filter(array_map('trim', explode(',', $category))))
     */
    private function parseCategories(string $category): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $category))));
    }

    public function testSingleCategoryIsUnchanged(): void
    {
        $this->assertSame(['cave'], $this->parseCategories('cave'));
    }

    public function testCommaSeparatedListIsSplit(): void
    {
        $this->assertSame(['cave', 'abandoned', 'mine'], $this->parseCategories('cave,abandoned,mine'));
    }

    public function testWhitespaceAroundCommasIsTrimmed(): void
    {
        $this->assertSame(['cave', 'abandoned'], $this->parseCategories('cave, abandoned'));
    }

    public function testEmptySegmentsAreDropped(): void
    {
        $this->assertSame(['cave', 'abandoned'], $this->parseCategories('cave,,abandoned,'));
    }

    /**
     * Mirrors the whereIn-vs-where branch: a single value still uses the
     * plain equality filter, exactly as before this feature.
     */
    private function usesWhereIn(array $categories): bool
    {
        return count($categories) > 1;
    }

    public function testSingleValueUsesPlainEquality(): void
    {
        $this->assertFalse($this->usesWhereIn($this->parseCategories('cave')));
    }

    public function testMultipleValuesUseWhereIn(): void
    {
        $this->assertTrue($this->usesWhereIn($this->parseCategories('cave,abandoned')));
    }

    // -------------------------------------------------------------------------
    // location=<slug> → places column
    // -------------------------------------------------------------------------

    /**
     * Mirrors the type => places column map used once a slug resolves.
     */
    private function columnForLocationType(string $type): ?string
    {
        return [
            'country'  => 'places.country_id',
            'region'   => 'places.region_id',
            'district' => 'places.district_id',
            'locality' => 'places.locality_id',
        ][$type] ?? null;
    }

    public function testEachLevelMapsToItsOwnColumn(): void
    {
        $this->assertSame('places.country_id', $this->columnForLocationType('country'));
        $this->assertSame('places.region_id', $this->columnForLocationType('region'));
        $this->assertSame('places.district_id', $this->columnForLocationType('district'));
        $this->assertSame('places.locality_id', $this->columnForLocationType('locality'));
    }

    public function testUnknownTypeHasNoColumn(): void
    {
        $this->assertNull($this->columnForLocationType('city'));
    }
}
