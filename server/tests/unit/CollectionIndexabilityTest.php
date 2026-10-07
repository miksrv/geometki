<?php

use App\Libraries\CollectionIndexability;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for App\Libraries\CollectionIndexability — the silent SEO gate
 * for collections: a collection is index,follow only
 * when it has at least COLLECTION_INDEX_MIN_PLACES places, a plain-text
 * description of at least COLLECTION_INDEX_MIN_DESCRIPTION characters, and
 * is not hidden. Pure PHP, no DB.
 *
 * @internal
 */
final class CollectionIndexabilityTest extends CIUnitTestCase
{
    private function longEnoughDescription(): string
    {
        // Plain prose, no markdown — comfortably over COLLECTION_INDEX_MIN_DESCRIPTION (500).
        return str_repeat('Это длинное описание коллекции мест для проверки порога индексации. ', 10);
    }

    public function testHiddenCollectionIsNeverIndexableRegardlessOfContent(): void
    {
        $description = $this->longEnoughDescription();

        $this->assertFalse(CollectionIndexability::isIndexable($description, 10, true));
    }

    public function testTooFewPlacesIsNotIndexable(): void
    {
        $description = $this->longEnoughDescription();

        $this->assertFalse(CollectionIndexability::isIndexable($description, COLLECTION_INDEX_MIN_PLACES - 1, false));
    }

    public function testExactlyMinPlacesCountsAsEnough(): void
    {
        $description = $this->longEnoughDescription();

        $this->assertTrue(CollectionIndexability::isIndexable($description, COLLECTION_INDEX_MIN_PLACES, false));
    }

    public function testShortDescriptionIsNotIndexableEvenWithEnoughPlaces(): void
    {
        $this->assertFalse(CollectionIndexability::isIndexable('Коротко.', COLLECTION_INDEX_MIN_PLACES + 5, false));
    }

    public function testNullDescriptionIsNotIndexable(): void
    {
        $this->assertFalse(CollectionIndexability::isIndexable(null, COLLECTION_INDEX_MIN_PLACES + 5, false));
    }

    public function testAllThresholdsMetMakesItIndexable(): void
    {
        $description = $this->longEnoughDescription();

        $this->assertTrue(CollectionIndexability::isIndexable($description, COLLECTION_INDEX_MIN_PLACES + 2, false));
    }

    public function testMarkdownSyntaxDoesNotCountTowardsPlainTextLength(): void
    {
        // A description that is long only because of markdown/HTML noise,
        // but whose actual visible text is short, must not be indexable.
        $noise = str_repeat('**_[a](http://example.com/very/long/path/that/is/mostly/markup)_** ', 40);

        $this->assertFalse(CollectionIndexability::isIndexable($noise, COLLECTION_INDEX_MIN_PLACES + 1, false));
    }

    public function testStripMarkdownRemovesHeadingsEmphasisLinksAndCode(): void
    {
        $markdown = "# Заголовок\n\nЭто **жирный** и *курсив* текст с `кодом` и [ссылкой](http://example.com).";

        $plain = CollectionIndexability::stripMarkdown($markdown);

        $this->assertStringNotContainsString('#', $plain);
        $this->assertStringNotContainsString('**', $plain);
        $this->assertStringNotContainsString('`', $plain);
        $this->assertStringNotContainsString('http://example.com', $plain);
        $this->assertStringContainsString('ссылкой', $plain);
        $this->assertStringContainsString('жирный', $plain);
    }

    public function testStripMarkdownRemovesListMarkersAndBlockquotes(): void
    {
        $markdown = "> Цитата\n- Пункт один\n- Пункт два\n1. Первый\n2. Второй";

        $plain = CollectionIndexability::stripMarkdown($markdown);

        $this->assertStringNotContainsString('>', $plain);
        $this->assertStringNotContainsString('- ', $plain);
        $this->assertStringContainsString('Пункт один', $plain);
        $this->assertStringContainsString('Первый', $plain);
    }

    public function testStripMarkdownCollapsesWhitespace(): void
    {
        $markdown = "Слово1\n\n\nСлово2    Слово3";

        $plain = CollectionIndexability::stripMarkdown($markdown);

        $this->assertSame('Слово1 Слово2 Слово3', $plain);
    }
}
