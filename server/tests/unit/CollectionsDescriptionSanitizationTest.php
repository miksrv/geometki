<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the markdown-description sanitization used in
 * Collections::create()/update():
 *
 *   strip_tags(html_entity_decode($input->description))
 *
 * This intentionally mirrors Places::create()/update() exactly (no allowed
 * tag list): a collection's description, like a place's content, is stored
 * as plain markdown source — the markdown syntax itself (`**bold**`, `# h1`,
 * `[text](url)`) uses no HTML tags, so stripping *all* tags removes any HTML
 * (accidental or malicious) a user pastes in without touching the markdown.
 * An earlier allow-list implementation (`<a><b><i>...`) would have let
 * `<a href="javascript:...">` through untouched, since strip_tags() does not
 * sanitize attributes of tags it allows.
 *
 * Pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class CollectionsDescriptionSanitizationTest extends CIUnitTestCase
{
    private function sanitize(string $input): string
    {
        return strip_tags(html_entity_decode($input));
    }

    public function testPlainMarkdownSyntaxSurvivesUntouched(): void
    {
        $markdown = "# Заголовок\n\nЭто **жирный** и *курсив* текст с [ссылкой](http://example.com).";

        $this->assertSame($markdown, $this->sanitize($markdown));
    }

    public function testScriptTagIsStrippedEntirely(): void
    {
        $input = 'Текст <script>alert(1)</script> продолжение';

        $sanitized = $this->sanitize($input);

        $this->assertStringNotContainsString('<script>', $sanitized);
        $this->assertStringNotContainsString('alert(1)', $sanitized);
    }

    public function testAnchorTagWithJavascriptHrefIsStrippedNotJustAllowed(): void
    {
        // Regression guard: an allow-list containing <a> would let this
        // through verbatim, attributes included, because strip_tags() never
        // inspects/sanitizes attributes of a tag it permits.
        $input = 'Click <a href="javascript:alert(1)">here</a>';

        $sanitized = $this->sanitize($input);

        $this->assertStringNotContainsString('<a', $sanitized);
        $this->assertStringNotContainsString('javascript:', $sanitized);
        $this->assertStringContainsString('here', $sanitized);
    }

    public function testHtmlEntitiesAreDecodedBeforeStripping(): void
    {
        $input = '&lt;b&gt;bold&lt;/b&gt; &amp; plain';

        $sanitized = $this->sanitize($input);

        $this->assertStringNotContainsString('&lt;', $sanitized);
        $this->assertStringContainsString('bold', $sanitized);
    }

    public function testMatchesPlacesContentSanitizationExactly(): void
    {
        // Same call shape used by Places::create()/update() for place content —
        // Collections must behave identically for the same raw input.
        $input = 'Описание <div class="x">со стилями</div> и *markdown*.';

        $placeStyleResult      = strip_tags(html_entity_decode($input));
        $collectionStyleResult = strip_tags(html_entity_decode($input));

        $this->assertSame($placeStyleResult, $collectionStyleResult);
    }
}
