<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * A guest has no session until their first score (no visit starts one): PUT rating starts it
 * and answers it, their next score with it changes the same vote, and a guest without a
 * session never takes another visitor's vote that has none either.
 *
 * @internal
 */
final class GuestRatingTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('author1');
        $this->createUser('user1');
        $this->db->table('places')->insert(['id' => 'place1', 'user_id' => 'author1', 'lat' => 53.1, 'lon' => 57.2]);
        // A signed-in user's vote kept no session
        $this->db->table('rating')->insert(['id' => 'rating1', 'place_id' => 'place1', 'user_id' => 'user1', 'session_id' => null, 'value' => 2]);
    }

    private function score(int $score, ?string $session = null): array
    {
        $request  = $session ? $this->withHeaders(['Session' => $session]) : $this;
        $response = $request->withBodyFormat('json')->put('rating', ['place' => 'place1', 'score' => $score]);

        return json_decode($response->getJSON() ?: '{}', true) ?? [];
    }

    public function testTheFirstScoreStartsTheSessionAndTheNextOneChangesTheVote(): void
    {
        $session = $this->score(5)['session'] ?? null;

        $this->assertNotEmpty($session);
        $this->assertSame(1, $this->db->table('sessions')->where('id', $session)->countAllResults());
        $this->assertSame(2, $this->db->table('rating')->where('place_id', 'place1')->countAllResults());
        $this->assertSame(2, (int) $this->db->table('rating')->where('id', 'rating1')->get()->getRow()->value);

        $this->assertArrayNotHasKey('session', $this->score(3, $session));
        $this->assertSame(2, $this->db->table('rating')->where('place_id', 'place1')->countAllResults());
        $this->assertSame(3, (int) $this->db->table('rating')->where('session_id', $session)->get()->getRow()->value);
        // One session for the guest: the activity of the score did not start another
        $this->assertSame(1, $this->db->table('sessions')->countAllResults());
    }

    public function testAGuestWithoutASessionSeesNoVoteAsTheirs(): void
    {
        $this->assertArrayNotHasKey('vote', json_decode($this->get('rating/place1')->getJSON(), true));
    }
}
