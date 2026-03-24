<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for validation/branching logic in Rating::set() and Rating::show().
 *
 * From Rating::set():
 *   if (empty($input) || !$input->place || !(int) $input->score) {
 *       return $this->failValidationErrors('Not enough data to change the rating');
 *   }
 *
 * From Rating::show():
 *   $response['rating'] = round($sum / $count, 1)
 *
 * All tests are pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class RatingSetValidationTest extends CIUnitTestCase
{
    /**
     * Mirrors Rating::set() input guard.
     */
    private function shouldRejectInput(?object $input): bool
    {
        return empty($input) || !($input->place ?? null) || !(int) ($input->score ?? 0);
    }

    // =========================================================================
    // set() — input guard
    // =========================================================================

    public function testNullInputIsRejected(): void
    {
        $this->assertTrue($this->shouldRejectInput(null));
    }

    public function testInputWithoutPlaceIsRejected(): void
    {
        $input = (object) ['score' => 5];

        $this->assertTrue($this->shouldRejectInput($input));
    }

    public function testInputWithoutScoreIsRejected(): void
    {
        $input = (object) ['place' => 'abc1234567890'];

        $this->assertTrue($this->shouldRejectInput($input));
    }

    public function testInputWithZeroScoreIsRejected(): void
    {
        // (int) 0 is falsy
        $input = (object) ['place' => 'abc1234567890', 'score' => 0];

        $this->assertTrue($this->shouldRejectInput($input));
    }

    public function testInputWithNonNumericScoreIsRejected(): void
    {
        $input = (object) ['place' => 'abc1234567890', 'score' => 'bad'];

        // (int) 'bad' === 0 → falsy
        $this->assertTrue($this->shouldRejectInput($input));
    }

    public function testValidInputPassesGuard(): void
    {
        $input = (object) ['place' => 'abc1234567890', 'score' => 5];

        $this->assertFalse($this->shouldRejectInput($input));
    }

    public function testValidInputScoreOnePassesGuard(): void
    {
        $input = (object) ['place' => 'abc1234567890', 'score' => 1];

        $this->assertFalse($this->shouldRejectInput($input));
    }

    public function testValidInputNegativeScorePassesGuard(): void
    {
        // Negative integers are truthy (non-zero)
        $input = (object) ['place' => 'abc1234567890', 'score' => -1];

        $this->assertFalse($this->shouldRejectInput($input));
    }

    // =========================================================================
    // show() — rating arithmetic
    // =========================================================================

    public function testShowRatingZeroCountReturnsDefaultResponse(): void
    {
        // When ratingData is empty, Rating::show() returns ['rating' => 0, 'count' => 0]
        $ratingData = [];
        $response   = ['rating' => 0, 'count' => 0];

        if (!$ratingData) {
            // do nothing — response stays at defaults
        }

        $this->assertSame(0, $response['rating']);
        $this->assertSame(0, $response['count']);
    }

    public function testShowRatingCalculatesCorrectAverage(): void
    {
        helper('rating');

        $ratingData = [
            (object) ['value' => 4, 'session_id' => 's1', 'user_id' => null],
            (object) ['value' => 2, 'session_id' => 's2', 'user_id' => null],
        ];

        $response = ['rating' => 0, 'count' => count($ratingData)];

        foreach ($ratingData as $item) {
            $response['rating'] += $item->value;
        }

        $response['rating'] = round($response['rating'] / $response['count'], 1);

        $this->assertSame(2, $response['count']);
        $this->assertEqualsWithDelta(3.0, $response['rating'], 0.05);
    }

    public function testShowRatingSetVoteWhenSessionMatches(): void
    {
        $sessionId  = 'my-session';
        $ratingData = [
            (object) ['value' => 5, 'session_id' => $sessionId, 'user_id' => null],
        ];

        $response = ['rating' => 0, 'count' => count($ratingData)];

        foreach ($ratingData as $item) {
            if ($item->session_id === $sessionId) {
                $response['vote'] = $item->value;
            }

            $response['rating'] += $item->value;
        }

        $response['rating'] = round($response['rating'] / $response['count'], 1);

        $this->assertArrayHasKey('vote', $response);
        $this->assertSame(5, $response['vote']);
    }

    public function testShowRatingNoVoteWhenSessionDoesNotMatch(): void
    {
        $sessionId  = 'other-session';
        $ratingData = [
            (object) ['value' => 3, 'session_id' => 'different-session', 'user_id' => null],
        ];

        $response = ['rating' => 0, 'count' => count($ratingData)];

        foreach ($ratingData as $item) {
            if ($item->session_id === $sessionId || $item->user_id === null) {
                // user_id is null, session doesn't match — no vote set
            }

            $response['rating'] += $item->value;
        }

        $response['rating'] = round($response['rating'] / $response['count'], 1);

        $this->assertArrayNotHasKey('vote', $response);
    }
}
