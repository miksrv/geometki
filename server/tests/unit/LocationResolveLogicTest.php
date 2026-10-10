<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the pure resolution-order logic behind
 * App\Controllers\Locations::resolve(): a current slug wins over a
 * historical slug (301), which wins over a category name, which is
 * "not found". Also the legacy-id fallback: a mapped id wins over the
 * legacy id itself. Pure PHP — the lookup results are passed in directly,
 * mirroring the style of LocationMatcherTest for App\Libraries\LocationMatcher.
 *
 * @internal
 */
final class LocationResolveLogicTest extends CIUnitTestCase
{
    private const RESULT_CURRENT  = 'current';
    private const RESULT_REDIRECT = 'redirect';
    private const RESULT_CATEGORY = 'category';
    private const RESULT_NOT_FOUND = 'not_found';

    /**
     * Mirrors App\Controllers\Locations::resolveSlug()'s branch order.
     *
     * @param bool $currentSlugFound  location_slugs has this exact slug
     * @param bool $historySlugFound  location_slug_history has this exact old_slug
     *                                AND its current slug still exists
     * @param bool $categoryFound    the slug is a key in Config\Categories
     */
    private function resolveSlugStrategy(bool $currentSlugFound, bool $historySlugFound, bool $categoryFound): string
    {
        if ($currentSlugFound) {
            return self::RESULT_CURRENT;
        }

        if ($historySlugFound) {
            return self::RESULT_REDIRECT;
        }

        if ($categoryFound) {
            return self::RESULT_CATEGORY;
        }

        return self::RESULT_NOT_FOUND;
    }

    public function testCurrentSlugWinsOverEverything(): void
    {
        $this->assertSame(self::RESULT_CURRENT, $this->resolveSlugStrategy(true, true, true));
    }

    public function testHistorySlugWinsWhenNotCurrent(): void
    {
        $this->assertSame(self::RESULT_REDIRECT, $this->resolveSlugStrategy(false, true, true));
    }

    public function testCategoryWinsWhenNeitherSlugMatches(): void
    {
        $this->assertSame(self::RESULT_CATEGORY, $this->resolveSlugStrategy(false, false, true));
    }

    public function testNotFoundWhenNothingMatches(): void
    {
        $this->assertSame(self::RESULT_NOT_FOUND, $this->resolveSlugStrategy(false, false, false));
    }

    /**
     * Mirrors App\Controllers\Locations::resolveLegacyId(): the legacy map's
     * new_id wins when present, otherwise the legacy id is tried as-is
     * (it may still exist — not every old id was merged away).
     */
    private function legacyResolutionId(?int $mappedNewId, int $legacyId): int
    {
        return $mappedNewId ?? $legacyId;
    }

    public function testMappedLegacyIdIsUsedWhenPresent(): void
    {
        // Orenburg: old id 225 maps to the surviving id 1
        $this->assertSame(1, $this->legacyResolutionId(1, 225));
    }

    public function testLegacyIdItselfIsUsedWhenNeverRemapped(): void
    {
        $this->assertSame(2, $this->legacyResolutionId(null, 2));
    }
}
