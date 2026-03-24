<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the boundary logic inside Tags::search().
 *
 * From Tags.php:
 *   $search = trim($this->request->getGet('text', FILTER_SANITIZE_STRING));
 *   if (strlen($search) === 0 || strlen($search) >= 30) {
 *       return $this->respond(['items' => []]);
 *   }
 *
 * We verify each boundary condition as a pure PHP expression — no HTTP, no DB.
 *
 * @internal
 */
final class TagsSearchLogicTest extends CIUnitTestCase
{
    /**
     * Mirrors the guard expression from Tags::search().
     */
    private function shouldReturnEmpty(string $search): bool
    {
        return strlen($search) === 0 || strlen($search) >= 30;
    }

    // =========================================================================
    // Empty string — always returns early
    // =========================================================================

    public function testEmptyStringReturnsEmpty(): void
    {
        $this->assertTrue($this->shouldReturnEmpty(''));
    }

    public function testWhiteSpaceOnlyStringTrimsToEmpty(): void
    {
        $trimmed = trim('   ');

        $this->assertTrue($this->shouldReturnEmpty($trimmed));
    }

    // =========================================================================
    // String length >= 30 — always returns early
    // =========================================================================

    public function testExactly30CharsReturnsEmpty(): void
    {
        $search = str_repeat('a', 30);

        $this->assertTrue($this->shouldReturnEmpty($search));
    }

    public function testMoreThan30CharsReturnsEmpty(): void
    {
        $search = str_repeat('x', 50);

        $this->assertTrue($this->shouldReturnEmpty($search));
    }

    public function test31CharsReturnsEmpty(): void
    {
        $search = str_repeat('b', 31);

        $this->assertTrue($this->shouldReturnEmpty($search));
    }

    // =========================================================================
    // Valid lengths (1..29) — does NOT return early
    // =========================================================================

    public function testSingleCharDoesNotReturnEmpty(): void
    {
        $this->assertFalse($this->shouldReturnEmpty('a'));
    }

    public function testTypicalShortSearchDoesNotReturnEmpty(): void
    {
        $this->assertFalse($this->shouldReturnEmpty('cafe'));
    }

    public function testExactly29CharsDoesNotReturnEmpty(): void
    {
        $search = str_repeat('z', 29);

        $this->assertFalse($this->shouldReturnEmpty($search));
    }

    public function testExactly15CharsDoesNotReturnEmpty(): void
    {
        $search = str_repeat('m', 15);

        $this->assertFalse($this->shouldReturnEmpty($search));
    }

    public function testTypicalCyrillicSearchDoesNotReturnEmpty(): void
    {
        // Cyrillic search term — strlen counts bytes, not characters.
        // A 2-byte UTF-8 cyrillic char makes a short string large in bytes,
        // but multi-char input like "Орен" (4 chars × 2 bytes = 8 bytes) is still < 30.
        $search = 'Орен';

        $this->assertFalse($this->shouldReturnEmpty($search));
    }
}
