<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the pure decision logic in App\Controllers\Locations and
 * App\Controllers\Categories::locations() — type validation, the indexable
 * threshold, which child level(s) a location type has, and the parents-
 * chain order. Pure PHP, no DB — mirrors the controllers' own conditions.
 *
 * @internal
 */
final class LocationsControllerLogicTest extends CIUnitTestCase
{
    private array $validTypes = ['country', 'region', 'district', 'locality'];

    // -------------------------------------------------------------------------
    // Type validation — mirrors the `in_array($type, self::TYPES, true)` guard
    // used by resolve()/categories()/children()/summary()
    // -------------------------------------------------------------------------

    private function isValidType(?string $type): bool
    {
        return in_array($type, $this->validTypes, true);
    }

    public function testAllFourLevelsAreValid(): void
    {
        foreach ($this->validTypes as $type) {
            $this->assertTrue($this->isValidType($type));
        }
    }

    public function testUnknownTypeIsInvalid(): void
    {
        $this->assertFalse($this->isValidType('city'));
    }

    public function testNullTypeIsInvalid(): void
    {
        $this->assertFalse($this->isValidType(null));
    }

    // -------------------------------------------------------------------------
    // Indexable threshold — mirrors `$placesCount >= $threshold` everywhere
    // it appears (resolve, categories, children, summary, Sitemap, Categories::locations)
    // -------------------------------------------------------------------------

    private function isIndexable(int $placesCount, int $threshold = 5): bool
    {
        return $placesCount >= $threshold;
    }

    public function testBelowThresholdIsNotIndexable(): void
    {
        $this->assertFalse($this->isIndexable(4));
    }

    public function testExactlyAtThresholdIsIndexable(): void
    {
        $this->assertTrue($this->isIndexable(5));
    }

    public function testZeroPlacesIsNotIndexable(): void
    {
        $this->assertFalse($this->isIndexable(0));
    }

    public function testAboveThresholdIsIndexable(): void
    {
        $this->assertTrue($this->isIndexable(108));
    }

    // -------------------------------------------------------------------------
    // Which child level(s) a location type has — mirrors children()'s branches
    // -------------------------------------------------------------------------

    /**
     * @return string[] child types this location level has
     */
    private function childLevelsFor(string $type): array
    {
        return match ($type) {
            'country'  => ['region'],
            'region'   => ['district', 'locality'],
            'district' => ['locality'],
            'locality' => [],
            default    => [],
        };
    }

    public function testCountrysChildrenAreRegions(): void
    {
        $this->assertSame(['region'], $this->childLevelsFor('country'));
    }

    public function testRegionsChildrenAreDistrictsAndLocalities(): void
    {
        $this->assertSame(['district', 'locality'], $this->childLevelsFor('region'));
    }

    public function testDistrictsChildrenAreLocalities(): void
    {
        $this->assertSame(['locality'], $this->childLevelsFor('district'));
    }

    public function testLocalityHasNoChildren(): void
    {
        $this->assertSame([], $this->childLevelsFor('locality'));
    }

    // -------------------------------------------------------------------------
    // Parents chain membership — mirrors parentsChain()'s per-level conditions
    // (country→…→immediate parent, excluding the entity itself)
    // -------------------------------------------------------------------------

    /**
     * @return string[] ancestor types included in the parents chain, in order
     */
    private function parentTypesFor(string $type): array
    {
        return match ($type) {
            'country'  => [],
            'region'   => ['country'],
            'district' => ['country', 'region'],
            'locality' => ['country', 'region', 'district'],
            default    => [],
        };
    }

    public function testCountryHasNoParents(): void
    {
        $this->assertSame([], $this->parentTypesFor('country'));
    }

    public function testRegionsOnlyParentIsCountry(): void
    {
        $this->assertSame(['country'], $this->parentTypesFor('region'));
    }

    public function testDistrictsParentsAreCountryThenRegion(): void
    {
        $this->assertSame(['country', 'region'], $this->parentTypesFor('district'));
    }

    public function testLocalitysParentsAreCountryRegionThenDistrict(): void
    {
        $this->assertSame(['country', 'region', 'district'], $this->parentTypesFor('locality'));
    }

    public function testNoParentsChainIncludesItsOwnType(): void
    {
        foreach ($this->validTypes as $type) {
            $this->assertNotContains($type, $this->parentTypesFor($type));
        }
    }
}
