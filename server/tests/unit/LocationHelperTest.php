<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for normalizeLocationName() in app/Helpers/location_helper.php —
 * the key the geocoder's alias-matching step (App\Libraries\LocationMatcher,
 * via App\Models\LocationAliasesModel) compares names with.
 *
 * Pure PHP — no DB, no HTTP.
 *
 * @internal
 */
final class LocationHelperTest extends CIUnitTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        helper('location');
    }

    public function testLowercasesTheName(): void
    {
        $this->assertSame('оренбург', normalizeLocationName('Оренбург'));
    }

    public function testYoBecomesYe(): void
    {
        $this->assertSame('село никольское', normalizeLocationName('Село Никольское'));
        $this->assertSame('планерное', normalizeLocationName('Планёрное'));
    }

    public function testLeadingAndTrailingWhitespaceIsTrimmed(): void
    {
        $this->assertSame('оренбург', normalizeLocationName('  Оренбург  '));
    }

    public function testInternalWhitespaceRunsCollapseToOneSpace(): void
    {
        $this->assertSame('город оренбург', normalizeLocationName('город   оренбург'));
        $this->assertSame('город оренбург', normalizeLocationName("город\tоренбург"));
    }

    public function testDifferentCasingNormalizesTheSame(): void
    {
        $this->assertSame(normalizeLocationName('ОРЕНБУРГ'), normalizeLocationName('оренбург'));
    }

    public function testEnglishNamesAreLowercasedUnchanged(): void
    {
        $this->assertSame('orenburg', normalizeLocationName('Orenburg'));
    }

    public function testNullReturnsEmptyString(): void
    {
        $this->assertSame('', normalizeLocationName(null));
    }

    public function testEmptyStringReturnsEmptyString(): void
    {
        $this->assertSame('', normalizeLocationName(''));
    }

    public function testDistinctNamesStayDistinct(): void
    {
        $this->assertNotSame(normalizeLocationName('Пушкино'), normalizeLocationName('Пушкино-2'));
    }

    public function testUsableNameNeedsAtLeastOneLetter(): void
    {
        $this->assertTrue(isUsableLocationName('Оренбург'));
        $this->assertTrue(isUsableLocationName('Пушкино-2'));
        $this->assertFalse(isUsableLocationName('№ 20'));
        $this->assertFalse(isUsableLocationName('12'));
        $this->assertFalse(isUsableLocationName(''));
        $this->assertFalse(isUsableLocationName(null));
    }

    public function testTransliteratesTitleKeepingCase(): void
    {
        $this->assertSame('Argayashskiy munitsipalnyy okrug', transliterateLocationTitle('Аргаяшский муниципальный округ'));
        $this->assertSame('Shchelkovo', transliterateLocationTitle('Щёлково'));
        $this->assertSame('Orenburg Oblast', transliterateLocationTitle('Orenburg Oblast'));
    }
}
