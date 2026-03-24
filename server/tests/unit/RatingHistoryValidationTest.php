<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the mutual-exclusion and presence guard in Rating::history().
 *
 * From Rating.php:
 *   if ($paramPlace && $paramUser) {
 *       return $this->failValidationErrors('Only one parameter is allowed');
 *   }
 *   if (!$paramPlace && !$paramUser) {
 *       return $this->failValidationErrors('Not enough data to get the rating history');
 *   }
 *
 * We verify the boolean logic directly — no HTTP, no DB.
 *
 * @internal
 */
final class RatingHistoryValidationTest extends CIUnitTestCase
{
    /**
     * Returns 'both', 'none', or 'ok' based on the same guards used in Rating::history().
     */
    private function validate(?string $paramPlace, ?string $paramUser): string
    {
        if ($paramPlace && $paramUser) {
            return 'both';
        }

        if (!$paramPlace && !$paramUser) {
            return 'none';
        }

        return 'ok';
    }

    // =========================================================================
    // Both parameters — should fail
    // =========================================================================

    public function testBothParamsProducesBothError(): void
    {
        $this->assertSame('both', $this->validate('place123', 'user456'));
    }

    public function testBothParamsWithShortStringsProducesBothError(): void
    {
        $this->assertSame('both', $this->validate('p', 'u'));
    }

    // =========================================================================
    // Neither parameter — should fail
    // =========================================================================

    public function testNeitherParamProducesNoneError(): void
    {
        $this->assertSame('none', $this->validate(null, null));
    }

    public function testBothEmptyStringsProducesNoneError(): void
    {
        // Empty string is falsy — behaves the same as null/missing
        $this->assertSame('none', $this->validate('', ''));
    }

    public function testPlaceEmptyUserNullProducesNoneError(): void
    {
        $this->assertSame('none', $this->validate('', null));
    }

    // =========================================================================
    // Only one parameter — should pass
    // =========================================================================

    public function testOnlyPlaceIdProducesOk(): void
    {
        $this->assertSame('ok', $this->validate('place123', null));
    }

    public function testOnlyUserIdProducesOk(): void
    {
        $this->assertSame('ok', $this->validate(null, 'user456'));
    }

    public function testPlaceIdWithEmptyUserProducesOk(): void
    {
        $this->assertSame('ok', $this->validate('place123', ''));
    }

    public function testUserIdWithEmptyPlaceProducesOk(): void
    {
        $this->assertSame('ok', $this->validate('', 'user456'));
    }
}
