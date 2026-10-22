<?php

use App\Libraries\ReputationLibrary;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the shares of a place's votes (ReputationLibrary::placePoints()): half to
 * the author, half to those who had made the card by the time of the vote, by weight.
 * Pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class ReputationSharesTest extends CIUnitTestCase
{
    private const T = 1_760_000_000;

    private function vote(int $value, ?string $user = null, int $at = self::T): object
    {
        return (object) ['user_id' => $user, 'value' => $value, 'created_at' => $at];
    }

    private function contribution(string $user, string $type, int $at = self::T - 100): object
    {
        return (object) ['user_id' => $user, 'type' => $type, 'created_at' => $at];
    }

    public function testWithoutContributorsTheAuthorGetsTheWholeVote(): void
    {
        $points = ReputationLibrary::placePoints('author', [$this->vote(5), $this->vote(1)], []);

        $this->assertSame(['author' => 0], $points);
    }

    public function testEachScoreIsWorthItsPoints(): void
    {
        foreach ([1 => -2, 2 => -1, 4 => 1, 5 => 2] as $value => $expected) {
            $this->assertEquals(['author' => $expected], ReputationLibrary::placePoints('author', [$this->vote($value)], []));
        }

        $this->assertSame([], ReputationLibrary::placePoints('author', [$this->vote(3)], []));
    }

    public function testHalfGoesToTheContributorsByWeight(): void
    {
        // A photo (10) and an edit (5): 2/3 and 1/3 of the half
        $points = ReputationLibrary::placePoints('author', [$this->vote(5)], [
            $this->contribution('photographer', 'photo'),
            $this->contribution('editor', 'edit'),
        ]);

        $this->assertEqualsWithDelta(1.0, $points['author'], 1e-9);
        $this->assertEqualsWithDelta(2 / 3, $points['photographer'], 1e-9);
        $this->assertEqualsWithDelta(1 / 3, $points['editor'], 1e-9);
    }

    public function testTheAuthorsOwnContributionsCountInTheirShare(): void
    {
        $points = ReputationLibrary::placePoints('author', [$this->vote(5)], [
            $this->contribution('author', 'photo'),
            $this->contribution('editor', 'photo'),
        ]);

        $this->assertEqualsWithDelta(1.5, $points['author'], 1e-9);
        $this->assertEqualsWithDelta(0.5, $points['editor'], 1e-9);
    }

    public function testAContributionAfterTheVoteGetsNothingOfIt(): void
    {
        $points = ReputationLibrary::placePoints('author', [$this->vote(5, null, self::T)], [
            $this->contribution('editor', 'edit', self::T + 60),
        ]);

        $this->assertSame(['author' => 2], $points);
    }

    public function testAContributorGetsNoShareOfTheirOwnVote(): void
    {
        $points = ReputationLibrary::placePoints('author', [$this->vote(5, 'editor')], [
            $this->contribution('editor', 'edit'),
        ]);

        $this->assertSame(['author' => 2], $points);
    }

    public function testANegativeVoteIsSharedTheSameWay(): void
    {
        $points = ReputationLibrary::placePoints('author', [$this->vote(1)], [
            $this->contribution('editor', 'edit'),
        ]);

        $this->assertEqualsWithDelta(-1.0, $points['author'], 1e-9);
        $this->assertEqualsWithDelta(-1.0, $points['editor'], 1e-9);
    }

    public function testAPlaceWithoutAuthorGivesTheWholeVoteToTheContributors(): void
    {
        $points = ReputationLibrary::placePoints(null, [$this->vote(5)], [
            $this->contribution('editor', 'edit'),
        ]);

        $this->assertEqualsWithDelta(2.0, $points['editor'], 1e-9);
    }
}
