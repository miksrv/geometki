<?php

use CodeIgniter\Test\FeatureTestTrait;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\MySqlTestCase;

/**
 * Every public GET endpoint answers without a server error, for a guest and for a
 * signed-in user, on a small database: a place with a text, a photo, a comment and a
 * rating, in a region, in a collection. Endpoints that call outside services
 * (geocoders, sign-in providers, photo archives) are left out.
 *
 * @internal
 */
final class PublicEndpointsSmokeTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('user1');

        $this->db->table('location_countries')->insert(['id' => 1, 'title_ru' => 'Россия', 'title_en' => 'Russia']);
        $this->db->table('location_regions')->insert(['id' => 1, 'country_id' => 1, 'title_ru' => 'Башкортостан', 'title_en' => 'Bashkortostan']);
        $this->db->table('location_slugs')->insert(['slug' => 'bashkortostan', 'type' => 'region', 'entity_id' => 1, 'is_primary' => 1]);

        $this->db->table('places')->insert([
            'id' => 'place1', 'user_id' => 'user1', 'category' => 'waterfall', 'lat' => 53.1, 'lon' => 57.2,
            'country_id' => 1, 'region_id' => 1, 'slug' => 'vodopad-atysh', 'address_ru' => 'Башкортостан', 'address_en' => 'Bashkortostan',
        ]);
        $this->db->table('places_content')->insert([
            'id' => 'text1', 'place_id' => 'place1', 'user_id' => 'user1', 'locale' => 'ru',
            'title' => 'Водопад Атыш', 'content' => 'Один из самых красивых водопадов Урала.',
        ]);
        $this->db->table('photos')->insert([
            'id' => 'photo1', 'place_id' => 'place1', 'user_id' => 'user1', 'lat' => 53.1, 'lon' => 57.2,
            'filename' => 'photo1', 'extension' => 'jpg', 'filesize' => 1000, 'width' => 1200, 'height' => 800,
        ]);
        $this->db->table('comments')->insert(['id' => 'comment1', 'place_id' => 'place1', 'user_id' => 'user1', 'content' => 'Были здесь летом']);
        $this->db->table('rating')->insert(['id' => 'rating1', 'place_id' => 'place1', 'user_id' => 'user1', 'value' => 5]);
        $this->db->table('collections')->insert(['id' => 'coll1', 'user_id' => 'user1', 'title' => 'Водопады Башкирии', 'region_id' => 1, 'places_count' => 1]);
        $this->db->table('collections_places')->insert(['collection_id' => 'coll1', 'place_id' => 'place1', 'position' => 0]);
    }

    public static function endpoints(): array
    {
        $paths = [
            'poi', 'poi/photos', 'poi/place1',
            'osm-candidates?bounds=57.1,53.0,57.3,53.2', 'osm-candidates/unknown1',
            'places', 'places?search=Водопад', 'places?search=Во', 'places?sort=distance&lat=53&lon=57', 'places?category=waterfall',
            'places/place1', 'places/place1/texts', 'places/unknown1',
            'photos', 'photos?place=place1', 'external-photos?place=place1',
            'comments?place=place1',
            'mail/unsubscribe?token=broken',
            'push/key',
            'stats',
            'categories/waterfall/locations',
            'rating/place1',
            'feed', 'feed/pulse', 'feed/calendar', 'feed/calendar?tz=Asia/Yekaterinburg',
            'users', 'users/user1', 'users/user1/achievements', 'users/unknown1',
            'auth/me',
            'search?q=Водопад', 'search?q=Во', 'search?q=53.1,57.2', 'search/suggest?q=Водопад',
            'locations/resolve?slug=bashkortostan&type=region',
            'locations/region/1/categories', 'locations/region/1/children', 'locations/region/1/summary',
            'achievements', 'achievements/progress',
            'tags/search?text=вод',
            'bookmarks?place=place1', 'bookmarks/places',
            'visited?place=place1', 'visited/user/user1', 'visited/place1',
            'collections', 'collections?user=user1', 'collections/coll1', 'collections/coll1/recommended', 'collections/membership?placeId=place1',
            'sitemap',
        ];

        $cases = [];

        foreach ($paths as $path) {
            $cases['guest ' . $path]  = [$path, false];
            $cases['signed in ' . $path] = [$path, true];
        }

        return $cases;
    }

    #[DataProvider('endpoints')]
    public function testAnswersWithoutAServerError(string $path, bool $signedIn): void
    {
        if ($signedIn) {
            $this->signIn('user1');
        }

        [$route, $query] = array_pad(explode('?', $path, 2), 2, '');
        parse_str($query, $params);

        $response = $this->get($route, $params);

        $this->assertLessThan(500, $response->getStatusCode(), $path . ': ' . mb_substr((string) $response->getBody(), 0, 500));
    }

    public function testTheMapShowsOnePhotoPerPoint(): void
    {
        foreach (['photo2' => 53.1, 'photo3' => 53.5] as $id => $lat) {
            $this->db->table('photos')->insert([
                'id' => $id, 'place_id' => 'place1', 'user_id' => 'user1', 'lat' => $lat, 'lon' => 57.2,
                'filename' => $id, 'extension' => 'jpg', 'filesize' => 1000, 'width' => 1200, 'height' => 800,
            ]);
        }

        $body = json_decode($this->get('poi/photos')->getJSON(), true);

        $this->assertSame(2, $body['count']);
        $this->assertEqualsCanonicalizing(['photo1', 'photo3'], array_map(
            static fn ($item) => basename($item['full'], '.jpg'),
            $body['items']
        ));
    }
}
