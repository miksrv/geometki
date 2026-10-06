<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for the slug helper found in app/Helpers/slug_helper.php.
 *
 * All tests are pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class SlugHelperTest extends CIUnitTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        helper('slug');
    }

    // -------------------------------------------------------------------------
    // generatePlaceSlug(): Russian text
    // -------------------------------------------------------------------------

    public function testRussianTitleIsTransliteratedToBgnLikeLatin(): void
    {
        $this->assertSame(
            'gornyy-khrebet-shchuche-ozero',
            generatePlaceSlug('Горный хребет Щучье озеро')
        );
    }

    public function testRussianSoftAndHardSignsAreDropped(): void
    {
        $this->assertSame('obekt', generatePlaceSlug('Объект'));
    }

    public function testYoIsTransliteratedAsE(): void
    {
        $this->assertSame('eelka', generatePlaceSlug('Ёёлка'));
    }

    // -------------------------------------------------------------------------
    // generatePlaceSlug(): mixed content, punctuation, emoji
    // -------------------------------------------------------------------------

    public function testMixedLatinAndDigitsAreLowercasedAndJoined(): void
    {
        $this->assertSame('mount-everest-8848m', generatePlaceSlug('Mount Everest 8848m'));
    }

    public function testPunctuationCollapsesToSingleDashes(): void
    {
        $this->assertSame('hello-world', generatePlaceSlug('Hello,   World!!!'));
    }

    public function testLeadingAndTrailingPunctuationIsTrimmed(): void
    {
        $this->assertSame('place', generatePlaceSlug('--- Place! ---'));
    }

    public function testEmojiOnlyTitleReturnsNull(): void
    {
        $this->assertNull(generatePlaceSlug('🎉🎊'));
    }

    public function testNullTitleReturnsNull(): void
    {
        $this->assertNull(generatePlaceSlug(null));
    }

    public function testEmptyOrWhitespaceTitleReturnsNull(): void
    {
        $this->assertNull(generatePlaceSlug('   '));
    }

    // -------------------------------------------------------------------------
    // generatePlaceSlug(): length cut on word boundary
    // -------------------------------------------------------------------------

    public function testLongTitleIsCutToRoughlyEightyCharsOnWordBoundary(): void
    {
        $title = 'Very long place title that keeps going and going and going well past the eighty character budget we allow for a slug';
        $slug  = generatePlaceSlug($title);

        $this->assertLessThanOrEqual(80, strlen($slug));
        // Cutting on a word boundary means the result never ends mid-word with
        // a dangling dash, and re-running the generator on the cut slug is a no-op.
        $this->assertSame($slug, generatePlaceSlug($slug));
    }

    // -------------------------------------------------------------------------
    // placeSlugPath()
    // -------------------------------------------------------------------------

    public function testPlaceSlugPathJoinsIdAndSlugWithDash(): void
    {
        $this->assertSame('ab12cd34ef567-mount-everest', placeSlugPath('ab12cd34ef567', 'mount-everest'));
    }

    public function testPlaceSlugPathReturnsBareIdWhenSlugIsNull(): void
    {
        $this->assertSame('ab12cd34ef567', placeSlugPath('ab12cd34ef567', null));
    }
}
