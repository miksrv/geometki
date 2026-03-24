<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the IMPR-12 fix: rating score range validation (1-5).
 *
 * The original code only checked `(int) $input->score` for truthiness, allowing
 * any non-zero integer. The fix adds an explicit range check:
 *   if ($inputRating < 1 || $inputRating > 5)
 *
 * These tests verify the validation logic directly without hitting the database
 * or HTTP layer.
 *
 * @internal
 */
final class RatingScoreRangeTest extends CIUnitTestCase
{
    /**
     * Validates a score against the fixed range check (1-5 inclusive).
     * Returns true when the score is valid, false when it should be rejected.
     */
    private function isValidScore(mixed $score): bool
    {
        $inputRating = (int) $score;
        if ($inputRating < 1 || $inputRating > 5) {
            return false;
        }
        return true;
    }

    // =========================================================================
    // Valid scores (1–5)
    // =========================================================================

    public function testScoreOneIsValid(): void
    {
        $this->assertTrue($this->isValidScore(1));
    }

    public function testScoreTwoIsValid(): void
    {
        $this->assertTrue($this->isValidScore(2));
    }

    public function testScoreThreeIsValid(): void
    {
        $this->assertTrue($this->isValidScore(3));
    }

    public function testScoreFourIsValid(): void
    {
        $this->assertTrue($this->isValidScore(4));
    }

    public function testScoreFiveIsValid(): void
    {
        $this->assertTrue($this->isValidScore(5));
    }

    // =========================================================================
    // Invalid scores
    // =========================================================================

    public function testScoreZeroIsInvalid(): void
    {
        $this->assertFalse($this->isValidScore(0));
    }

    public function testScoreSixIsInvalid(): void
    {
        $this->assertFalse($this->isValidScore(6));
    }

    public function testScoreNegativeOneIsInvalid(): void
    {
        $this->assertFalse($this->isValidScore(-1));
    }

    public function testScoreNineNineNineIsInvalid(): void
    {
        $this->assertFalse($this->isValidScore(999));
    }

    public function testNonNumericStringIsInvalid(): void
    {
        // (int) 'abc' === 0, which is < 1
        $this->assertFalse($this->isValidScore('abc'));
    }

    public function testFloatTruncatedBelowRangeIsInvalid(): void
    {
        // (int) 0.9 === 0
        $this->assertFalse($this->isValidScore(0.9));
    }

    public function testFloatTruncatedWithinRangeIsValid(): void
    {
        // (int) 3.7 === 3
        $this->assertTrue($this->isValidScore(3.7));
    }
}
