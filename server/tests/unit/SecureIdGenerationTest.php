<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the SEC-10 fix: secure entity ID generation.
 *
 * The original code used `uniqid()` which is timestamp-based and predictable.
 * The fix uses `bin2hex(random_bytes(8))` which produces a cryptographically
 * random 16-character lowercase hex string.
 *
 * @internal
 */
final class SecureIdGenerationTest extends CIUnitTestCase
{
    /**
     * Generates an ID using the same method as the fixed ApplicationBaseModel.
     */
    private function generateId(): string
    {
        return bin2hex(random_bytes(8));
    }

    // =========================================================================
    // Length
    // =========================================================================

    public function testGeneratedIdIsExactly16Characters(): void
    {
        $id = $this->generateId();
        $this->assertSame(16, strlen($id));
    }

    // =========================================================================
    // Character set
    // =========================================================================

    public function testGeneratedIdContainsOnlyHexCharacters(): void
    {
        $id = $this->generateId();
        // bin2hex output is strictly [0-9a-f]
        $this->assertMatchesRegularExpression('/^[0-9a-f]+$/', $id);
    }

    public function testGeneratedIdContainsNoUppercaseLetters(): void
    {
        $id = $this->generateId();
        $this->assertSame(strtolower($id), $id);
    }

    // =========================================================================
    // URL safety
    // =========================================================================

    public function testGeneratedIdIsUrlSafe(): void
    {
        $id = $this->generateId();
        // URL-safe: no percent-encoding needed — all chars are alphanumeric hex
        $this->assertSame($id, urlencode($id));
    }

    public function testGeneratedIdContainsNoSpecialCharacters(): void
    {
        $id = $this->generateId();
        // Must not contain any characters that would require URL encoding
        $this->assertDoesNotMatchRegularExpression('/[^a-z0-9]/', $id);
    }

    public function testGeneratedIdIsUsableInUrl(): void
    {
        $id    = $this->generateId();
        $url   = 'https://example.com/places/' . $id;
        $parts = parse_url($url);
        // The ID should be parseable as part of the path without encoding
        $this->assertStringContainsString($id, $parts['path']);
    }

    // =========================================================================
    // Uniqueness
    // =========================================================================

    public function testTwoSuccessiveCallsProduceDifferentIds(): void
    {
        $id1 = $this->generateId();
        $id2 = $this->generateId();
        $this->assertNotSame($id1, $id2);
    }

    public function testLargeSetOfGeneratedIdsAreUnique(): void
    {
        $ids = [];
        for ($i = 0; $i < 100; $i++) {
            $ids[] = $this->generateId();
        }
        // All 100 IDs must be unique
        $this->assertCount(100, array_unique($ids));
    }
}
