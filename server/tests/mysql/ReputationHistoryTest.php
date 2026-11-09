<?php

use App\Libraries\ReputationLibrary;
use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * The history of a reputation (GET /users/:id/reputation): the votes on the places a person
 * made with their share of each, the newest first, a page at a time; the shares add up to the
 * reputation, and who voted is not told.
 *
 * @internal
 */
final class ReputationHistoryTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        // The history cache in memory: nothing left from another run in the file cache
        \Config\Services::injectMock('cache', new \CodeIgniter\Test\Mock\MockCache());

        $this->createUser('author');
        $this->createUser('editor');
        $this->createUser('voter');

        $this->db->table('places')->insert(['id' => 'place1', 'user_id' => 'author', 'category' => 'waterfall', 'lat' => 53.1, 'lon' => 57.2, 'slug' => 'atysh']);
        $this->db->table('places_content')->insert(['id' => 'text1', 'place_id' => 'place1', 'user_id' => 'author', 'locale' => 'ru', 'title' => 'Атыш', 'content' => 'Водопад.']);
        $this->db->table('places')->insert(['id' => 'place2', 'user_id' => 'author', 'category' => 'cave', 'lat' => 53.2, 'lon' => 57.3, 'slug' => 'cave']);

        // The editor's edit of place1 before its votes: half of each goes to them
        $this->db->table('activity')->insert(['id' => 'act1', 'type' => 'edit', 'place_id' => 'place1', 'user_id' => 'editor', 'created_at' => '2026-01-01 10:00:00']);

        $this->db->table('rating')->insertBatch([
            ['id' => 'r1', 'place_id' => 'place1', 'user_id' => 'voter', 'value' => 5, 'created_at' => '2026-02-01 10:00:00'],
            ['id' => 'r2', 'place_id' => 'place1', 'user_id' => null, 'value' => 1, 'created_at' => '2026-03-01 10:00:00'],
            ['id' => 'r3', 'place_id' => 'place2', 'user_id' => 'voter', 'value' => 4, 'created_at' => '2026-04-01 10:00:00'],
            // 3★ moves nobody: not in the history
            ['id' => 'r4', 'place_id' => 'place2', 'user_id' => 'editor', 'value' => 3, 'created_at' => '2026-05-01 10:00:00'],
        ]);

        (new ReputationLibrary())->recalculateUsers(['author', 'editor']);
    }

    public function testTheHistoryListsTheSharesNewestFirstAndAddsUpToTheReputation(): void
    {
        $answer = json_decode($this->get('users/author/reputation')->getJSON(), true);

        $this->assertSame(['r3', 'r2', 'r1'], array_column($answer['items'], 'id'));
        $this->assertSame([1, -1, 1], array_map('intval', array_column($answer['items'], 'points')));
        $this->assertSame([4, 1, 5], array_column($answer['items'], 'stars'));
        $this->assertSame(['author', 'author', 'author'], array_column($answer['items'], 'role'));
        $this->assertSame('place2', $answer['items'][0]['place']['id']);
        $this->assertSame('Атыш', $answer['items'][2]['place']['title']);
        $this->assertSame(3, $answer['count']);
        $this->assertNull($answer['next']);
        $this->assertSame((int) round(array_sum(array_column($answer['items'], 'points'))), $answer['reputation']);
        $this->assertArrayNotHasKey('author', $answer['items'][0]);

        $editor = json_decode($this->get('users/editor/reputation')->getJSON(), true);

        $this->assertSame(['r2', 'r1'], array_column($editor['items'], 'id'));
        // The only contributor takes the whole other half
        $this->assertEqualsWithDelta([-1.0, 1.0], array_column($editor['items'], 'points'), 1e-9);
        $this->assertSame(['contributor', 'contributor'], array_column($editor['items'], 'role'));

        $this->get('users/nobody/reputation')->assertStatus(404);
    }

    public function testTheHistoryComesAPageAtATime(): void
    {
        $rows = [];

        for ($i = 10; $i < 35; $i++) {
            $rows[] = ['id' => 'p' . $i, 'place_id' => 'place2', 'value' => 5, 'created_at' => '2026-06-' . sprintf('%02d', $i - 9) . ' 10:00:00'];
        }

        $this->db->table('rating')->insertBatch($rows);

        $first = json_decode($this->get('users/author/reputation')->getJSON(), true);

        $this->assertCount(20, $first['items']);
        $this->assertSame('p34', $first['items'][0]['id']);
        $this->assertSame(strtotime('2026-06-06 10:00:00') . '_p15', $first['next']);

        // A new score between the pages: the recount drops the cached history, nothing moves over
        $this->db->table('rating')->insert(['id' => 'p99', 'place_id' => 'place2', 'value' => 5, 'created_at' => '2026-07-01 10:00:00']);
        (new ReputationLibrary())->recalculateUsers(['author']);

        $second = json_decode($this->get('users/author/reputation', ['cursor' => $first['next']])->getJSON(), true);

        $this->assertCount(8, $second['items']);
        $this->assertNull($second['next']);
        $this->assertSame(29, $second['count']);
        $this->assertSame([], array_intersect(array_column($first['items'], 'id'), array_column($second['items'], 'id')));

        // A broken cursor is the first page
        $this->assertSame('p99', json_decode($this->get('users/author/reputation', ['cursor' => 'x'])->getJSON(), true)['items'][0]['id']);
    }
}
