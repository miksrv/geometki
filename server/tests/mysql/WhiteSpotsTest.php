<?php

use App\Libraries\LevelsLibrary;
use App\Models\OsmCandidatesModel;
use App\Models\UsersModel;
use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * White spots (features/25-visits-and-exploration.md, step 4): an open OSM candidate is a spot
 * nobody has added yet. A candidate that duplicates one of our places is linked to it
 * automatically and stays out of the map; the author of a place created from a candidate is its
 * pioneer (MODIFIER_SPOT, `spots_opened`); a deleted place opens its candidates again.
 *
 * @internal
 */
final class WhiteSpotsTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('user1');
        $this->createUser('admin1', ['role' => 'admin']);

        $this->db->table('osm_tiles')->insert([
            'id' => 1, 'tile_lat' => 531, 'tile_lon' => 572, 'status' => 'done', 'priority' => 0, 'attempts' => 1, 'candidates_count' => 3,
        ]);

        // Атыш: a waterfall we have, a candidate with the same name 80 m away, one with another
        // name 40 m away of the same category, and an open spot 5 km away
        $this->db->table('places')->insert([
            'id' => 'place1', 'user_id' => 'user1', 'category' => 'waterfall', 'lat' => 53.1, 'lon' => 57.2, 'slug' => 'atysh',
        ]);
        $this->db->table('places_content')->insert([
            'id' => 'text1', 'place_id' => 'place1', 'user_id' => 'user1', 'locale' => 'ru', 'title' => 'Водопад Атыш', 'content' => 'Водопад.',
        ]);

        foreach ([
            ['cand1', 'Атыш', 'waterfall', 53.1007, 57.2],
            ['cand2', 'Безымянный', 'waterfall', 53.1003, 57.2],
            ['cand3', 'Кук-Караук', 'waterfall', 53.14, 57.25],
        ] as [$id, $name, $category, $lat, $lon]) {
            $this->db->table('osm_candidates')->insert([
                'id' => $id, 'source' => 'osm', 'osm_type' => 'node', 'osm_id' => crc32($id), 'tile_id' => 1,
                'lat' => $lat, 'lon' => $lon, 'name' => $name, 'osm_tag' => 'waterway=waterfall', 'category' => $category,
                'tags' => '{}', 'score' => 5, 'tier' => 'known', 'status' => 'open',
            ]);
        }
    }

    public function testDuplicatesOfOurPlacesAreLinkedAndStayOffTheMap(): void
    {
        $model = new OsmCandidatesModel();

        $this->assertSame(2, $model->linkDuplicatesIn([53.0, 57.0, 53.3, 57.4]));
        // Nothing more to link the second time
        $this->assertSame(0, $model->linkDuplicatesIn([53.0, 57.0, 53.3, 57.4]));

        $rows = $this->db->table('osm_candidates')->select('id, status, place_id, linked_by')->orderBy('id')->get()->getResultArray();

        $this->assertSame(['linked', 'linked', 'open'], array_column($rows, 'status'));
        $this->assertSame(['place1', 'place1', null], array_column($rows, 'place_id'));
        $this->assertSame([null, null, null], array_column($rows, 'linked_by'));

        // A user sees the one white spot, an admin all three
        $list = json_decode($this->get('osm-candidates', ['bounds' => '53.0,57.0,53.3,57.4'])->getJSON(), true);
        $this->assertSame(['cand3'], array_column($list['items'], 'id'));

        $this->signIn('admin1');
        $list = json_decode($this->get('osm-candidates', ['bounds' => '53.0,57.0,53.3,57.4'])->getJSON(), true);
        $this->assertCount(3, $list['items']);

        // Nobody is a pioneer of an automatic link
        $this->assertSame(0, $model->spotsOpened('user1'));
    }

    public function testThePioneerOfASpotGetsTheBonusAndLosesItWithThePlace(): void
    {
        $model = new OsmCandidatesModel();

        // user1 creates the place of cand3 (what Places::create does with `candidate`)
        $this->db->table('places')->insert([
            'id' => 'place3', 'user_id' => 'user1', 'category' => 'waterfall', 'lat' => 53.1401, 'lon' => 57.2501, 'slug' => 'kuk-karauk',
        ]);
        $this->db->table('places_content')->insert([
            'id' => 'text3', 'place_id' => 'place3', 'user_id' => 'user1', 'locale' => 'ru', 'title' => 'Водопад Кук-Караук', 'content' => 'Водопад.',
        ]);

        $this->assertTrue($model->linkToNewPlace('cand3', 'place3', 'user1', 53.1401, 57.2501, 'waterfall', ['Водопад Кук-Караук']));
        $this->assertSame(1, $model->spotsOpened('user1'));

        $user = (new UsersModel())->select('id, experience, level')->find('user1');
        (new LevelsLibrary())->calculate($user, false);
        $this->assertSame(MODIFIER_SPOT, (int) $this->db->table('users')->select('experience')->where('id', 'user1')->get()->getRow()->experience);

        // An admin linking somebody else's place by hand is no pioneer
        $this->assertTrue($model->linkToPlace('cand1', 'place1', 'admin1', true));
        $this->assertSame(0, $model->spotsOpened('admin1'));

        // The place goes: its candidates are open again, the credit too
        $this->assertSame(1, $model->reopenOfPlace('place3'));
        $row = $this->db->table('osm_candidates')->select('status, place_id, linked_by')->where('id', 'cand3')->get()->getRowArray();
        $this->assertSame(['status' => 'open', 'place_id' => null, 'linked_by' => null], $row);
        $this->assertSame(0, $model->spotsOpened('user1'));
    }

    public function testACreatedPlaceLinksTheCandidatesAroundIt(): void
    {
        $model = new OsmCandidatesModel();

        // Somebody adds the waterfall 30 m from cand3 without going through the candidate
        $this->db->table('places')->insert([
            'id' => 'place3', 'user_id' => 'user1', 'category' => 'waterfall', 'lat' => 53.1402, 'lon' => 57.25, 'slug' => 'kuk',
        ]);
        $this->db->table('places_content')->insert([
            'id' => 'text3', 'place_id' => 'place3', 'user_id' => 'user1', 'locale' => 'ru', 'title' => 'Водопад', 'content' => 'Водопад.',
        ]);

        $this->assertSame(1, $model->linkDuplicatesAround(53.1402, 57.25));
        $row = $this->db->table('osm_candidates')->select('status, place_id, linked_by')->where('id', 'cand3')->get()->getRowArray();
        $this->assertSame(['status' => 'linked', 'place_id' => 'place3', 'linked_by' => null], $row);

        // Moved 50 m: still its duplicate
        $this->assertSame(0, $model->reopenFarFrom('place3', 53.1406, 57.25));

        // Moved a kilometre away: the candidate it left behind is open again
        $this->db->table('places')->where('id', 'place3')->update(['lat' => 53.1492]);
        $this->assertSame(1, $model->reopenFarFrom('place3', 53.1492, 57.25));
        $row = $this->db->table('osm_candidates')->select('status, place_id')->where('id', 'cand3')->get()->getRowArray();
        $this->assertSame(['status' => 'open', 'place_id' => null], $row);

        // A link made on purpose (the pioneer's, an admin's) stays wherever the place goes
        $this->assertTrue($model->linkToPlace('cand3', 'place3', 'user1', true));
        $this->assertSame(0, $model->reopenFarFrom('place3', 53.1492, 57.25));
    }
}
