<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * Place lists carry `bookmarked` and `visited` for a signed-in visitor, not only
 * GET /places: the place cards of search and collections show the bookmark and the
 * "You've been here" badge from them (PlaceFormatterLibrary::markVisitorState()).
 *
 * @internal
 */
final class VisitorPlaceStateTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('user1');

        foreach (['place1' => 'Водопад Кук-Караук', 'place2' => 'Водопад Атыш', 'place3' => 'Водопад Гадельша'] as $id => $title) {
            $this->db->table('places')->insert(['id' => $id, 'lat' => 53.1, 'lon' => 57.2]);
            $this->db->table('places_content')->insert(['id' => 'text' . $id, 'place_id' => $id, 'locale' => 'ru', 'title' => $title, 'content' => '']);
        }

        $this->db->table('users_bookmarks')->insert(['id' => 'bookmark1', 'user_id' => 'user1', 'place_id' => 'place1']);
        $this->db->table('users_visited_places')->insert(['id' => 'visit1', 'user_id' => 'user1', 'place_id' => 'place2']);

        $this->db->table('collections')->insert(['id' => 'coll1', 'user_id' => 'user1', 'title' => 'Водопады Башкирии', 'places_count' => 3]);

        foreach (['place1', 'place2', 'place3'] as $position => $placeId) {
            $this->db->table('collections_places')->insert(['collection_id' => 'coll1', 'place_id' => $placeId, 'position' => $position]);
        }
    }

    /**
     * @return array<string, array{bookmarked: mixed, visited: mixed}>
     */
    private function flags(array $items): array
    {
        $result = [];

        foreach ($items as $item) {
            $result[$item['id']] = ['bookmarked' => $item['bookmarked'] ?? null, 'visited' => $item['visited'] ?? null];
        }

        ksort($result);

        return $result;
    }

    private const SIGNED_IN = [
        'place1' => ['bookmarked' => true, 'visited' => false],
        'place2' => ['bookmarked' => false, 'visited' => true],
        'place3' => ['bookmarked' => false, 'visited' => false],
    ];

    private const GUEST = [
        'place1' => ['bookmarked' => null, 'visited' => null],
        'place2' => ['bookmarked' => null, 'visited' => null],
        'place3' => ['bookmarked' => null, 'visited' => null],
    ];

    public function testPlacesList(): void
    {
        $this->signIn('user1');

        $this->assertSame(self::SIGNED_IN, $this->flags(json_decode($this->get('places')->getJSON(), true)['items']));
    }

    public function testSearch(): void
    {
        $this->signIn('user1');

        $body = json_decode($this->get('search', ['q' => 'Водопад'])->getJSON(), true);

        $this->assertSame(self::SIGNED_IN, $this->flags($body['places']['items']));
    }

    public function testCollection(): void
    {
        $this->signIn('user1');

        $body = json_decode($this->get('collections/coll1')->getJSON(), true);

        $this->assertSame(self::SIGNED_IN, $this->flags($body['places']));
    }

    public function testAGuestGetsNoFlags(): void
    {
        $this->assertSame(self::GUEST, $this->flags(json_decode($this->get('search', ['q' => 'Водопад'])->getJSON(), true)['places']['items']));
        $this->assertSame(self::GUEST, $this->flags(json_decode($this->get('collections/coll1')->getJSON(), true)['places']));
    }
}
