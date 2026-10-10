<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for the location-slug building blocks in app/Helpers/slug_helper.php:
 * transliterateToSlug() (the scheme shared with generatePlaceSlug(), pinned
 * here from the location side too since both must never diverge),
 * stripLeadingSettlementWord(), and generateLocationBaseSlug().
 *
 * Pure PHP — no DB, no HTTP. Collision resolution (qualifying with a parent,
 * reserved words) is tested separately in LocationSlugLibraryTest, since it
 * needs App\Libraries\LocationSlugLibrary::claimSlug().
 *
 * @internal
 */
final class LocationSlugHelperTest extends CIUnitTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        helper('slug');
    }

    // -------------------------------------------------------------------------
    // transliterateToSlug(): the one fixed scheme, same as generatePlaceSlug()
    // -------------------------------------------------------------------------

    public function testTransliterationMatchesThePlaceSlugScheme(): void
    {
        $title = 'Оренбургская область';

        $this->assertSame(generatePlaceSlug($title), transliterateToSlug($title));
    }

    public function testTransliteratesBashkortostan(): void
    {
        $this->assertSame('bashkortostan', transliterateToSlug('Башкортостан'));
    }

    public function testNullReturnsNull(): void
    {
        $this->assertNull(transliterateToSlug(null));
    }

    public function testBlankReturnsNull(): void
    {
        $this->assertNull(transliterateToSlug('   '));
    }

    // -------------------------------------------------------------------------
    // stripLeadingSettlementWord()
    // -------------------------------------------------------------------------

    private function settlementWords(): array
    {
        return config('LocationSlugs')->settlementTypeWords;
    }

    public function testStripsLeadingSeloWord(): void
    {
        $this->assertSame('Никольское', stripLeadingSettlementWord('село Никольское', $this->settlementWords()));
    }

    public function testStripsLeadingGorodWord(): void
    {
        $this->assertSame('Москва', stripLeadingSettlementWord('город Москва', $this->settlementWords()));
    }

    public function testIsCaseInsensitive(): void
    {
        $this->assertSame('Москва', stripLeadingSettlementWord('Город Москва', $this->settlementWords()));
    }

    public function testDoesNotStripTheWordWhenItIsNotLeading(): void
    {
        // "Старое Село" — "село" is part of the name, not a type prefix
        $this->assertSame('Старое Село', stripLeadingSettlementWord('Старое Село', $this->settlementWords()));
    }

    public function testDistrictWordIsNotInTheSettlementList(): void
    {
        // "район" stays — districts keep their type word in the slug
        // (features/20-location-seo-pages.md: "sovetskiy-rayon-orenburgskaya-oblast")
        $this->assertSame('Советский район', stripLeadingSettlementWord('Советский район', $this->settlementWords()));
    }

    public function testLongerMultiWordPhraseWinsOverAShorterOverlappingOne(): void
    {
        // "посёлок городского типа" must be checked before the shorter "посёлок"
        $words = $this->settlementWords();
        $this->assertSame(
            'Прогресс',
            stripLeadingSettlementWord('посёлок городского типа Прогресс', $words)
        );
    }

    public function testWordWithNothingAfterItIsLeftAlone(): void
    {
        $this->assertSame('село', stripLeadingSettlementWord('село', $this->settlementWords()));
    }

    public function testNameThatMerelyStartsWithTheSameLettersIsNotStripped(): void
    {
        // "Городище" is itself a real settlement name — must not be mistaken
        // for "город" ("city") followed by the name "ище".
        $this->assertSame('Городище', stripLeadingSettlementWord('Городище', $this->settlementWords()));
    }

    // -------------------------------------------------------------------------
    // generateLocationBaseSlug()
    // -------------------------------------------------------------------------

    public function testStripsSettlementWordThenTransliterates(): void
    {
        $this->assertSame('nikolskoe', generateLocationBaseSlug('село Никольское', $this->settlementWords()));
    }

    public function testRegionNameKeepsItsOblastWord(): void
    {
        $this->assertSame('orenburgskaya-oblast', generateLocationBaseSlug('Оренбургская область', $this->settlementWords()));
    }

    public function testDistrictNameKeepsItsRayonWord(): void
    {
        $this->assertSame('sovetskiy-rayon', generateLocationBaseSlug('Советский район', $this->settlementWords()));
    }

    public function testNullTitleReturnsNull(): void
    {
        $this->assertNull(generateLocationBaseSlug(null, $this->settlementWords()));
    }

    public function testWithoutSettlementWordsListFallsBackToPlainTransliteration(): void
    {
        $this->assertSame('selo-nikolskoe', generateLocationBaseSlug('село Никольское', []));
    }
}
