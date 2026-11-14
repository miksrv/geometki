<?php

use App\Libraries\GameLibrary;
use App\Libraries\QuestsLibrary;
use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * The game (features/26-game-seasons-and-quests.md): a visit confirmed by "I am here" or by a
 * photo shot at the place gives season points, once a season for a place; the seasons follow
 * the calendar and are frozen when closed; a quest is walked point by point, and what a walker
 * has not opened never leaves the server.
 *
 * @internal
 */
final class GameTest extends MySqlTestCase
{
    use FeatureTestTrait;

    /** The waterfall of the tests: 53.1, 57.2 */
    private const NEAR = ['lat' => 53.1004, 'lon' => 57.2004];
    private const FAR  = ['lat' => 53.2, 'lon' => 57.2];

    /** The game's switch before the test; null when the test was skipped before it was read */
    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('admin1', ['role' => 'admin']);
        $this->createUser('user1');
        $this->createUser('user2');

        $this->db->table('location_countries')->insert(['id' => 1, 'title_en' => 'Russia', 'title_ru' => 'Россия']);
        $this->db->table('location_regions')->insert(['id' => 10, 'country_id' => 1, 'title_en' => 'Bashkortostan', 'title_ru' => 'Башкортостан']);
        $this->db->table('location_regions')->insert(['id' => 11, 'country_id' => 1, 'title_en' => 'Orenburg Oblast', 'title_ru' => 'Оренбургская область']);

        $this->place('place1', 'waterfall', 53.1, 57.2, 10);
        $this->place('place2', 'memorial', 53.3, 57.3, 10);
        $this->place('place3', 'cave', 51.7, 55.1, 11);
    }

    public function testTheSectionTellsTheSeasonAndThePublicTableOfPoints(): void
    {
        $game = json_decode($this->get('game')->getJSON(), true);

        $this->assertSame(GameLibrary::seasonOf(date('Y-m-d'))['id'], $game['season']['id']);
        $this->assertTrue($game['season']['current']);
        $this->assertFalse($game['season']['closed']);
        $this->assertGreaterThan(0, $game['season']['daysLeft']);
        $this->assertSame(10, $game['rules']['base']);
        $this->assertSame(2, $game['rules']['categories']['waterfall']);
        $this->assertSame([['upTo' => 1, 'factor' => 2], ['upTo' => 5, 'factor' => 1.5]], $game['rules']['order']);
        $this->assertSame([], $game['awards']);
        $this->assertNull($game['season']['image']);
        $this->assertArrayNotHasKey('me', $game);

        // The season is made by itself, and has no award of its own
        $this->assertSame(1, $this->db->table('game_seasons')->where('id', $game['season']['id'])->countAllResults());
        $this->assertSame(0, $this->db->table('achievements')->countAllResults());
    }

    public function testIWasHereOnTheSpotCountsThePlaceAndIsAPlainVisitOtherwise(): void
    {
        $this->signIn('user1');

        // Far away, or without a position: an ordinary visit, never an error, nothing in the season
        $far = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'] + self::FAR)->getJSON(), true);

        $this->assertTrue($far['isNew']);
        $this->assertFalse($far['game']['confirmed']);
        $this->assertSame(0, $far['game']['points']);
        $this->assertNotEmpty($far['game']['far']);
        $this->assertNull($this->db->table('users_visited_places')->where('user_id', 'user1')->get()->getRow()->confirmed);
        $this->assertSame(0, $this->db->table('game_points')->countAllResults());

        // Now on the spot: the visit of the week is confirmed, the place counts (10 × waterfall 2 × the first 2)
        $near = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'] + self::NEAR)->getJSON(), true);

        $this->assertFalse($near['isNew']);
        $this->assertSame($far['id'], $near['id']);
        $this->assertTrue($near['game']['confirmed']);
        $this->assertSame(40, $near['game']['points']);
        $this->assertSame('geo', $this->db->table('users_visited_places')->where('user_id', 'user1')->get()->getRow()->confirmed);
        // The coordinates are compared and dropped
        $this->assertNull($this->db->table('users')->where('id', 'user1')->get()->getRow()->last_lat);

        // A new visit on the spot at once
        $this->signIn('user2');
        $first = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place2', 'lat' => 53.3, 'lon' => 57.3])->getJSON(), true);

        $this->assertTrue($first['isNew']);
        $this->assertTrue($first['game']['confirmed']);
        $this->assertSame(20, $first['game']['points']);
    }

    public function testAPhotoCountsThePlaceButIsNoCheckInUntilThePersonTaps(): void
    {
        $user  = $this->db->table('users')->where('id', 'user1')->get()->getRow();
        $place = $this->db->table('places')->where('id', 'place1')->get()->getRow();

        $this->photo('photo1', 'place1', 'user1', self::NEAR, date('Y-m-d') . ' 10:00:00');
        $this->assertSame(45, (new GameLibrary())->photoUploaded($user, $place, 'photo1', (object) self::NEAR, date('Y-m-d') . ' 10:00:00')['points']);

        // The score is there; the visit is quiet: no event, not the person's check-in, nobody's visitor
        $visit = $this->db->table('users_visited_places')->where('user_id', 'user1')->get()->getRow();

        $this->assertSame(2, (int) $visit->hidden);
        $this->assertSame(0, $this->db->table('activity')->where(['type' => 'visit', 'visit_id' => $visit->id])->countAllResults());

        $this->signIn('user1');
        $me = json_decode($this->get('visits/me?place=place1')->getJSON(), true);

        $this->assertSame([], $me['items']);
        $this->assertSame(45, $me['game']['earned']);
        $this->assertSame(0, json_decode($this->get('visits?place=place1')->getJSON(), true)['count']);

        // The person taps "I was here": the same visit, shown now and new to them; no more points
        $tap = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'] + self::NEAR)->getJSON(), true);

        $this->assertSame($visit->id, $tap['id']);
        $this->assertTrue($tap['isNew']);
        $this->assertSame(0, $tap['game']['points']);
        $this->assertSame(0, (int) $this->db->table('users_visited_places')->where('id', $visit->id)->get()->getRow()->hidden);
        $this->assertSame(1, $this->db->table('activity')->where(['type' => 'visit', 'visit_id' => $visit->id])->countAllResults());
        $this->assertCount(1, json_decode($this->get('visits/me?place=place1')->getJSON(), true)['items']);
        $this->assertSame(45, (int) $this->db->table('game_points')->where('user_id', 'user1')->get()->getRow()->points);
    }

    public function testTheExplorersListCanBeInTheSeasonsOrderWithItsPoints(): void
    {
        // user2 has more this season than user1; the administrator has none
        $this->signIn('user1');
        $this->withBodyFormat('json')->post('visits', ['place' => 'place2', 'lat' => 53.3, 'lon' => 57.3])->assertStatus(201);
        $this->signIn('user2');
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1'] + self::NEAR)->assertStatus(201);

        $list = json_decode($this->get('users?sort=season')->getJSON(), true);

        $this->assertSame(['user2', 'user1', 'admin1'], array_column($list['items'], 'id'));
        $this->assertSame([40, 20, 0], array_column($list['items'], 'points'));
        $this->assertSame(3, $list['count']);

        // Any other order carries the points too
        $this->assertSame(40, array_column(json_decode($this->get('users?sort=experience')->getJSON(), true)['items'], 'points', 'id')['user2']);
    }

    public function testIAmHereConfirmsAVisitNearThePlaceOnly(): void
    {
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->assertStatus(401);

        $this->signIn('user1');

        // Eleven kilometres away: no visit, no points
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::FAR)->assertStatus(400);
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'])->assertStatus(400);
        $this->assertSame(0, $this->db->table('users_visited_places')->countAllResults());

        $first = json_decode($this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->getJSON(), true);

        // base 10 × waterfall 2 × the first of the season 2
        $this->assertTrue($first['confirmed']);
        $this->assertTrue($first['isNew']);
        $this->assertSame(40, $first['points']);
        $this->assertSame(40, $first['total']);

        $visit = $this->db->table('users_visited_places')->where('user_id', 'user1')->get()->getRow();

        $this->assertSame('geo', $visit->confirmed);
        $this->assertSame(date('Y-m-d') . ' 12:00:00', $visit->visited_at);
        // The visit is an ordinary one: its event is in the log
        $this->assertSame(1, $this->db->table('activity')->where(['type' => 'visit', 'visit_id' => $visit->id])->countAllResults());
        // The coordinates are compared and dropped
        $user = $this->db->table('users')->where('id', 'user1')->get()->getRow();
        $this->assertNull($user->last_lat);
        // A confirmed visit is a contribution: MODIFIER_VISIT
        $this->assertSame(MODIFIER_VISIT, (int) $user->experience);

        // Once a season for a place
        $again = json_decode($this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->getJSON(), true);

        $this->assertFalse($again['isNew']);
        $this->assertSame(0, $again['points']);
        $this->assertSame(40, $again['total']);
        $this->assertSame(1, $this->db->table('game_points')->countAllResults());

        // The second one of the season gets ×1.5
        $this->signIn('user2');
        $second = json_decode($this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->getJSON(), true);

        $this->assertSame(30, $second['points']);

        // The place page: what is left to get there, and the visitor's own score
        $me = json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true);

        $this->assertSame(30, $me['game']['earned']);
        $this->assertSame('geo', $me['game']['way']);
        $this->assertSame(3, $me['game']['position']);
        $this->assertSame('geo', $me['items'][0]['confirmed']);
    }

    public function testAPhotoShotAtThePlaceConfirmsTheVisitOfItsDay(): void
    {
        $game   = new GameLibrary();
        $user   = $this->db->table('users')->where('id', 'user1')->get()->getRow();
        $place  = $this->db->table('places')->where('id', 'place1')->get()->getRow();
        $season = GameLibrary::seasonOf(date('Y-m-d'));
        // A day of this season, not today: the photo is uploaded at home
        $shot   = max($season['from'], date('Y-m-d', strtotime('-3 days')));

        // No position, no shot date, shot far away, shot before the season: no proof
        $this->photo('photo0', 'place1', 'user1', self::NEAR, $shot . ' 10:00:00');
        $this->assertNull($game->photoUploaded($user, $place, 'photo0', null, $shot . ' 10:00:00'));
        $this->assertNull($game->photoUploaded($user, $place, 'photo0', (object) self::NEAR, null));
        $this->assertNull($game->photoUploaded($user, $place, 'photo0', (object) self::FAR, $shot . ' 10:00:00'));
        $this->assertNull($game->photoUploaded($user, $place, 'photo0', (object) self::NEAR, '2020-05-05 10:00:00'));
        $this->assertSame(0, $this->db->table('users_visited_places')->countAllResults());

        $result = $game->photoUploaded($user, $place, 'photo0', (object) self::NEAR, $shot . ' 10:00:00');

        // The photo makes the visit of its shot day; 40 for the place and 5 for the photo
        $this->assertSame(45, $result['points']);
        $visit = $this->db->table('users_visited_places')->where('user_id', 'user1')->get()->getRow();
        $this->assertSame('photo', $visit->confirmed);
        $this->assertSame($shot . ' 12:00:00', $visit->visited_at);
        $this->assertSame($visit->id, $this->db->table('photos')->where('id', 'photo0')->get()->getRow()->visit_id);

        // "I am here" first, a photo later: the photo adds its bonus to the same score
        $this->signIn('user2');
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->assertStatus(200);
        $this->photo('photo1', 'place1', 'user2', self::NEAR, date('Y-m-d') . ' 09:00:00');

        $user2  = $this->db->table('users')->where('id', 'user2')->get()->getRow();
        $bonus  = $game->photoUploaded($user2, $place, 'photo1', (object) self::NEAR, date('Y-m-d') . ' 09:00:00');

        $this->assertSame(5, $bonus['points']);
        $row = $this->db->table('game_points')->where('user_id', 'user2')->get()->getRow();
        $this->assertSame('photo', $row->way);
        $this->assertSame(35, (int) $row->points);
        $this->assertSame('photo', $this->db->table('users_visited_places')->where('user_id', 'user2')->get()->getRow()->confirmed);

        // Another photo of the same place: nothing more
        $this->photo('photo2', 'place1', 'user2', self::NEAR, date('Y-m-d') . ' 09:05:00');
        $this->assertSame(0, $game->photoUploaded($user2, $place, 'photo2', (object) self::NEAR, date('Y-m-d') . ' 09:05:00')['points']);

        // The photo goes (and the other one with it): the score "I am here" made stays, without the bonus
        $this->db->table('photos')->where('id', 'photo2')->delete();
        $game->photoDeleted('photo1');
        $row = $this->db->table('game_points')->where('user_id', 'user2')->get()->getRow();
        $this->assertSame('geo', $row->way);
        $this->assertSame(30, (int) $row->points);
        $this->assertNull($row->photo_id);
        $this->assertSame('geo', $this->db->table('users_visited_places')->where('user_id', 'user2')->get()->getRow()->confirmed);
    }

    public function testADeletedProofTakesThePointsBackWhileTheSeasonIsOpen(): void
    {
        $game  = new GameLibrary();
        $user  = $this->db->table('users')->where('id', 'user1')->get()->getRow();
        $place = $this->db->table('places')->where('id', 'place1')->get()->getRow();
        $now   = date('Y-m-d') . ' 10:00:00';

        $this->photo('photo1', 'place1', 'user1', self::NEAR, $now);
        $this->photo('photo2', 'place1', 'user1', self::NEAR, $now);
        $game->photoUploaded($user, $place, 'photo1', (object) self::NEAR, $now);

        // Another photo shot there this season takes the proof over
        $game->photoDeleted('photo1');
        $this->db->table('photos')->where('id', 'photo1')->delete();
        $this->assertSame('photo2', $this->db->table('game_points')->get()->getRow()->photo_id);

        // The last one: the score goes, the visit is not confirmed any more
        $game->photoDeleted('photo2');
        $this->assertSame(0, $this->db->table('game_points')->countAllResults());
        $this->assertNull($this->db->table('users_visited_places')->get()->getRow()->confirmed);

        // A deleted visit takes its score with it
        $this->signIn('user1');
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place2', 'lat' => 53.3, 'lon' => 57.3])->assertStatus(200);
        $visitId = $this->db->table('game_points')->get()->getRow()->visit_id;
        $this->delete('visits/' . $visitId)->assertStatus(200);
        $this->assertSame(0, $this->db->table('game_points')->countAllResults());
    }

    public function testSeasonsFollowTheCalendar(): void
    {
        $this->assertSame(['id' => '2026-cold', 'key' => 'cold', 'year' => 2026, 'from' => '2026-10-01', 'to' => '2027-03-31'], GameLibrary::seasonOf('2026-11-11'));
        $this->assertSame('2026-warm', GameLibrary::seasonOf('2026-04-01')['id']);
        $this->assertSame('2026-warm', GameLibrary::seasonOf('2026-09-30')['id']);
        // A cold season is named by the year it starts in, and ends with March
        $this->assertSame('2026-cold', GameLibrary::seasonOf('2026-10-01')['id']);
        $this->assertSame('2026-cold', GameLibrary::seasonOf('2027-03-31')['id']);
        $this->assertNull(GameLibrary::seasonById('2026-winter'));
    }

    public function testAClosedSeasonIsFrozen(): void
    {
        $game = new GameLibrary();
        $past = GameLibrary::seasonOf(date('Y-m-d', strtotime('-200 days')));

        $game->ensureSeason($past);
        $this->db->table('users_visited_places')->insert([
            'id' => 'visit1', 'user_id' => 'user1', 'place_id' => 'place1', 'visited_at' => $past['from'] . ' 12:00:00', 'confirmed' => 'geo',
        ]);
        $this->db->table('game_points')->insertBatch([
            ['id' => 'gp1', 'season' => $past['id'], 'user_id' => 'user1', 'kind' => 'place', 'place_id' => 'place1', 'visit_id' => 'visit1', 'points' => 40, 'created_at' => $past['from'] . ' 12:00:00'],
            ['id' => 'gp2', 'season' => $past['id'], 'user_id' => 'user2', 'kind' => 'place', 'place_id' => 'place1', 'visit_id' => null, 'points' => 30, 'created_at' => $past['from'] . ' 13:00:00'],
            ['id' => 'gp3', 'season' => $past['id'], 'user_id' => 'user2', 'kind' => 'place', 'place_id' => 'place2', 'visit_id' => null, 'points' => 20, 'created_at' => $past['from'] . ' 14:00:00'],
        ]);

        $this->assertSame([$past['id']], $game->tick());
        $this->assertSame([], $game->tick());

        $season = $this->db->table('game_seasons')->where('id', $past['id'])->get()->getRow();
        $this->assertNotNull($season->closed_at);
        $this->assertSame(2, (int) $season->players);
        $this->assertSame(2, (int) $season->places);

        $results = $this->db->table('game_results')->where('season', $past['id'])->orderBy('place')->get()->getResultArray();
        $this->assertSame(['user2', 'user1'], array_column($results, 'user_id'));
        $this->assertSame(['50', '40'], array_map('strval', array_column($results, 'points')));

        // A visit deleted later does not rewrite the table
        $this->signIn('user1');
        $this->delete('visits/visit1')->assertStatus(200);

        $page = json_decode($this->get('game/seasons/' . $past['id'])->getJSON(), true);

        $this->assertTrue($page['season']['closed']);
        $this->assertSame(['user2', 'user1'], array_map(static fn (array $row) => $row['user']['id'], $page['winners']));
        $this->assertSame(2, $page['me']['place']);
        $this->assertSame(40, $page['me']['points']);

        // No more confirmations for it; the current season is made by the same tick
        $this->assertNull($game->openSeason($past['from']));
        $this->assertSame($past['id'], json_decode($this->get('game')->getJSON(), true)['seasons'][0]['id']);
        $this->get('game/seasons/1999-warm')->assertStatus(404);
        $this->get('game/seasons/nonsense')->assertStatus(404);
    }

    public function testALimitedAwardWithinTheSeasonIsListedOnItAndEarnedByItsOwnRule(): void
    {
        $season = GameLibrary::seasonOf(date('Y-m-d'));

        // Within the season's dates: listed on the season. Another one, running past it: not
        $this->award('limited1', 'places_confirmed', 2, $season['from'] . ' 00:00:00', $season['to'] . ' 23:59:59');
        $this->award('longer1', 'places_confirmed', 1, $season['from'] . ' 00:00:00', date('Y-m-d', strtotime($season['to'] . ' +40 days')) . ' 23:59:59');

        $this->signIn('user1');
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->assertStatus(200);

        $awards = json_decode($this->get('game')->getJSON(), true)['awards'];

        $this->assertSame(['limited1'], array_column($awards, 'id'));
        $this->assertNull($awards[0]['earned']);
        $this->assertSame(1, $awards[0]['progress']['current']);
        $this->assertSame($season['to'], $awards[0]['to']);

        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place2', 'lat' => 53.3, 'lon' => 57.3])->assertStatus(200);

        $this->assertNotNull(json_decode($this->get('game/seasons/' . $season['id'])->getJSON(), true)['awards'][0]['earned']);
        $this->assertSame(2, $this->db->table('users_achievements')->where('user_id', 'user1')->countAllResults());

        // Taking part in the season is its badge on the profile: nothing is awarded for it
        $profile = json_decode($this->get('game/users/user1')->getJSON(), true);

        $this->assertSame([$season['id']], array_column($profile['seasons'], 'id'));
        $this->assertSame(60, $profile['seasons'][0]['points']);
        $this->assertSame(1, $profile['seasons'][0]['place']);
        $this->assertFalse($profile['seasons'][0]['closed']);
        $this->assertSame([], json_decode($this->get('game/users/user2')->getJSON(), true)['seasons']);

        // The awards are on the profile
        $this->assertContains('limited1', array_column(json_decode($this->get('users/user1/achievements')->getJSON(), true)['data'], 'id'));
    }

    public function testThePictureOfASeasonIsTheAdministrators(): void
    {
        $season = GameLibrary::seasonOf(date('Y-m-d'));

        $this->post('game/seasons/' . $season['id'] . '/image')->assertStatus(401);
        $this->signIn('user1');
        $this->post('game/seasons/' . $season['id'] . '/image')->assertStatus(403);
        $this->signIn('admin1');
        // No file: a validation error, the season itself is made
        $this->post('game/seasons/' . $season['id'] . '/image')->assertStatus(400);
        $this->post('game/seasons/nonsense/image')->assertStatus(404);
    }

    public function testTheRatingIsOverallAndByLocation(): void
    {
        $this->signIn('user1');
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->assertStatus(200);
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place3', 'lat' => 51.7, 'lon' => 55.1])->assertStatus(200);
        $this->signIn('user2');
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place1'] + self::NEAR)->assertStatus(200);

        $all = json_decode($this->get('game/leaders')->getJSON(), true);

        // user1: 40 + 40 (a cave, the first), user2: 30
        $this->assertSame(2, $all['count']);
        $this->assertSame(['user1', 'user2'], array_map(static fn (array $row) => $row['user']['id'], $all['items']));
        $this->assertSame([80, 30], array_column($all['items'], 'points'));
        $this->assertSame(2, $all['me']['place']);
        $this->assertSame(50, $all['me']['ahead']);
        $this->assertEqualsCanonicalizing([10, 11], array_column($all['locations'], 'id'));

        // The section names the two next to the visitor: whom to catch up with, who is catching up
        $mine = json_decode($this->get('game', ['rivals' => 1])->getJSON(), true)['me'];

        $this->assertNull($mine['behind']);
        $this->assertSame('user1', $mine['rivals']['above']['user']['id']);
        $this->assertSame(80, $mine['rivals']['above']['points']);
        $this->assertArrayNotHasKey('below', $mine['rivals']);

        $this->signIn('user1');
        $leader = json_decode($this->get('game', ['rivals' => 1])->getJSON(), true)['me'];

        // Only on request
        $this->assertArrayNotHasKey('rivals', json_decode($this->get('game')->getJSON(), true)['me']);

        // Someone without geopoints stands under the table: the last player is the one above
        $this->signIn('admin1');
        $newcomer = json_decode($this->get('game', ['rivals' => 1])->getJSON(), true)['me'];

        $this->assertNull($newcomer['place']);
        $this->assertSame('user2', $newcomer['rivals']['above']['user']['id']);
        $this->assertArrayNotHasKey('below', $newcomer['rivals']);

        $this->assertNull($leader['ahead']);
        $this->assertSame(50, $leader['behind']);
        $this->assertSame('user2', $leader['rivals']['below']['user']['id']);
        $this->signIn('user2');

        // Only the places of the region count there
        $region = json_decode($this->get('game/leaders', ['type' => 'region', 'id' => 11])->getJSON(), true);

        $this->assertSame(1, $region['count']);
        $this->assertSame('user1', $region['items'][0]['user']['id']);
        $this->assertSame(40, $region['items'][0]['points']);
        $this->assertArrayNotHasKey('me', $region);

        $this->get('game/leaders', ['type' => 'planet', 'id' => 1])->assertStatus(400);

        // "My season": the visitor's own places of the season, the latest first, with what each brought
        $this->signIn('user1');
        $mineSeason = json_decode($this->get('game/mine')->getJSON(), true);

        $this->assertSame(2, $mineSeason['count']);
        $this->assertSame(80, $mineSeason['points']);
        // Counted within the same second here: the order between the two is not told
        $this->assertEqualsCanonicalizing(['place1', 'place3'], array_map(static fn (array $item) => $item['place']['id'], $mineSeason['items']));
        $this->assertSame([40, 40], array_column($mineSeason['items'], 'points'));
        $this->assertSame('geo', $mineSeason['items'][0]['way']);
        $this->signIn('user2');

        // The valuable places: what the visitor has not confirmed this season
        $places = json_decode($this->get('game/places')->getJSON(), true);

        $this->assertEqualsCanonicalizing(['place2', 'place3'], array_column($places['items'], 'id'));
        $this->assertSame('place3', $places['items'][0]['id']);
        // The second one at the cave: ×1.5
        $this->assertSame(30, $places['items'][0]['game']['points']);

        // What is going on: the latest confirmations first, with who and where
        $recent = json_decode($this->get('game/recent')->getJSON(), true)['items'];

        $this->assertCount(3, $recent);
        $this->assertEqualsCanonicalizing(['user1', 'user1', 'user2'], array_map(static fn (array $item) => $item['user']['id'], $recent));
        $this->assertEqualsCanonicalizing([40, 40, 30], array_column($recent, 'points'));
        $this->assertSame('place', $recent[0]['kind']);
        $this->assertArrayHasKey('title', $recent[0]['place']);

        // Explored: the places a person has been to, of all the places of a region; the places
        // they added to the map are discoveries, not exploration (admin1 added them all)
        $this->assertSame([], json_decode($this->get('game/exploration', ['user' => 'admin1'])->getJSON(), true)['regions']);
        $explored = json_decode($this->get('game/exploration')->getJSON(), true);

        $this->assertSame([['type' => 'region', 'id' => 10, 'title' => 'Башкортостан', 'slug' => null, 'explored' => 1, 'total' => 2]], $explored['regions']);
    }

    public function testAWalkBegunCanBeGivenUpAndBegunAgain(): void
    {
        $this->signIn('admin1');
        $id = json_decode($this->withBodyFormat('json')->post('game/quests', [
            'titleRu' => 'По шагам',
            'mode'    => 'steps',
            'status'  => 'published',
            'points'  => [['place' => 'place1'], ['place' => 'place2']],
        ])->getJSON(), true)['id'];

        $this->signIn('user1');

        // Nothing to give up before the walk is begun
        $this->delete("game/quests/{$id}/walk")->assertStatus(404);

        $this->withBodyFormat('json')->post("game/quests/{$id}/start");
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(200);

        // Given up: the quest is as before it was begun, the visit made on it stays
        $this->delete("game/quests/{$id}/walk")->assertStatus(204);

        $quest = json_decode($this->get('game/quests/' . $id)->getJSON(), true);

        $this->assertNull($quest['walk']);
        $this->assertSame(['current', 'locked'], array_column($quest['items'], 'state'));
        $this->assertSame(0, $this->db->table('quests_walks_points')->countAllResults());
        $this->assertSame(1, $this->db->table('users_visited_places')->where(['user_id' => 'user1', 'confirmed' => 'geo'])->countAllResults());

        // Begun again: from the first point, which is confirmed once more on the spot
        $this->withBodyFormat('json')->post("game/quests/{$id}/start");
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(200);
        $last = json_decode($this->withBodyFormat('json')->post("game/quests/{$id}/confirm", ['lat' => 53.3, 'lon' => 57.3])->getJSON(), true);

        $this->assertTrue($last['finished']);

        // A quest walked to the end is walked for good
        $this->delete("game/quests/{$id}/walk")->assertStatus(400);
        $this->assertSame(1, $this->db->table('quests_walks')->where('finished_at IS NOT NULL', null, false)->countAllResults());
    }

    public function testNoMoreQuestsAreBegunThanTheLimit(): void
    {
        $this->signIn('admin1');
        $ids = [];

        for ($i = 0; $i <= QuestsLibrary::ACTIVE_MAX; $i++) {
            $ids[] = json_decode($this->withBodyFormat('json')->post('game/quests', [
                'titleRu' => 'Квест ' . $i,
                'mode'    => 'open',
                'status'  => 'published',
                'points'  => [['place' => 'place1'], ['place' => 'place2']],
            ])->getJSON(), true)['id'];
        }

        $this->signIn('user1');
        $last = array_pop($ids);

        foreach ($ids as $id) {
            $this->withBodyFormat('json')->post("game/quests/{$id}/start")->assertStatus(200);
        }

        // At the limit: the page says so, a new walk is refused, a begun one is still answered
        $this->assertSame(
            ['count' => QuestsLibrary::ACTIVE_MAX, 'max' => QuestsLibrary::ACTIVE_MAX],
            json_decode($this->get('game/quests/' . $last)->getJSON(), true)['activeWalks']
        );
        $this->withBodyFormat('json')->post("game/quests/{$last}/start")->assertStatus(400);
        $this->withBodyFormat('json')->post("game/quests/{$ids[0]}/start")->assertStatus(200);

        // One given up: room for the new one
        $this->delete("game/quests/{$ids[0]}/walk")->assertStatus(204);
        $this->withBodyFormat('json')->post("game/quests/{$last}/start")->assertStatus(200);
    }

    public function testAQuestIsWalkedStepByStep(): void
    {
        $body = [
            'titleRu' => 'По шагам',
            'mode'    => 'steps',
            'status'  => 'published',
            'points'  => [['place' => 'place1', 'hintRu' => 'У воды'], ['place' => 'place2']],
        ];

        // Quests are made by the administrators
        $this->withBodyFormat('json')->post('game/quests', $body)->assertStatus(401);
        $this->signIn('user1');
        $this->withBodyFormat('json')->post('game/quests', $body)->assertStatus(403);

        $this->signIn('admin1');
        $this->withBodyFormat('json')->post('game/quests', ['points' => [['place' => 'place1']]] + $body)->assertStatus(400);
        $this->withBodyFormat('json')->post('game/quests', ['titleRu' => ''] + $body)->assertStatus(400);
        $this->withBodyFormat('json')->post('game/quests', ['points' => [['place' => 'place1'], ['place' => 'nope']]] + $body)->assertStatus(400);
        $this->assertSame(0, $this->db->table('quests')->where('deleted_at', null)->countAllResults());

        $id = json_decode($this->withBodyFormat('json')->post('game/quests', $body)->getJSON(), true)['id'];

        $this->signIn('user1');
        $quest = json_decode($this->get('game/quests/' . $id)->getJSON(), true);

        $this->assertSame('По шагам', $quest['title']);
        $this->assertSame(2, $quest['points']);
        $this->assertGreaterThan(20000, $quest['length']);
        $this->assertNull($quest['walk']);
        // The first point is seen, the next one is not in the answer at all
        $this->assertSame(['current', 'locked'], array_column($quest['items'], 'state'));
        $this->assertSame('place1', $quest['items'][0]['place']['id']);
        $this->assertSame('У воды', $quest['items'][0]['hint']);
        $this->assertArrayNotHasKey('place', $quest['items'][1]);
        $this->assertStringNotContainsString('place2', $this->get('game/quests/' . $id)->getJSON());
        // The editor's view is the administrators' alone
        $this->assertArrayNotHasKey('place', json_decode($this->get('game/quests/' . $id, ['edit' => 1])->getJSON(), true)['items'][1]);

        // A walk begins on the quest's page, by the walker: "I am here" alone does not begin it
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(400);
        $this->assertSame(0, $this->db->table('quests_walks')->countAllResults());
        $this->assertSame(0, json_decode($this->withBodyFormat('json')->post("game/quests/{$id}/start")->getJSON(), true)['confirmed']);

        // Not at the point: no confirmation; the second point cannot be taken first
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::FAR)->assertStatus(400);
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", ['lat' => 53.3, 'lon' => 57.3])->assertStatus(400);

        $step = json_decode($this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->getJSON(), true);

        $this->assertFalse($step['finished']);
        $this->assertSame('place1', $step['place']);
        $this->assertSame(40, $step['points']);

        $quest = json_decode($this->get('game/quests/' . $id)->getJSON(), true);

        $this->assertSame(['done', 'current'], array_column($quest['items'], 'state'));
        $this->assertSame('place2', $quest['items'][1]['place']['id']);
        $this->assertSame(1, $quest['walk']['confirmed']);

        // The last point: the walk is over, the quest gives its bonus
        $last = json_decode($this->withBodyFormat('json')->post("game/quests/{$id}/confirm", ['lat' => 53.3, 'lon' => 57.3])->getJSON(), true);

        $this->assertTrue($last['finished']);
        $this->assertSame(20, $last['points']);
        // A walked quest is experience, not season points: the season has only its two places.
        // Two points are under the minimum: the minimum
        $this->assertSame(MODIFIER_QUEST_MIN, $last['bonus']);
        $this->assertSame(40 + 20, $last['total']);
        $this->assertSame(0, $this->db->table('game_points')->where('kind', 'quest')->countAllResults());
        $this->assertSame(2 * MODIFIER_VISIT + MODIFIER_QUEST_MIN, (int) $this->db->table('users')->where('id', 'user1')->get()->getRow()->experience);
        $this->assertSame(1, (int) $this->db->table('quests')->where('id', $id)->get()->getRow()->walked);
        $this->assertSame(2, $this->db->table('users_visited_places')->where(['user_id' => 'user1', 'confirmed' => 'geo'])->countAllResults());

        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(400);

        $list = json_decode($this->get('game/quests')->getJSON(), true);

        $this->assertSame(1, $list['count']);
        $this->assertNotNull($list['items'][0]['walk']['finished']);
        $this->assertSame(MODIFIER_QUEST_MIN, $list['items'][0]['bonus']);
        // Only the quests being walked: this one is walked already, so it leaves the game's lists
        // and stays on the walker's profile
        $this->assertSame(0, json_decode($this->get('game/quests', ['walk' => 'active'])->getJSON(), true)['count']);
        $this->assertSame(0, json_decode($this->get('game/quests', ['walk' => 'todo'])->getJSON(), true)['count']);
        $this->assertSame(1, json_decode($this->get('game/quests', ['walk' => 'done'])->getJSON(), true)['count']);
        $this->signIn('user2');
        $this->assertSame(1, json_decode($this->get('game/quests', ['walk' => 'todo'])->getJSON(), true)['count']);
        $this->assertSame(1, json_decode($this->get('game/quests', ['walk' => 'done', 'user' => 'user1'])->getJSON(), true)['count']);
        $this->signIn('user1');
        $this->assertSame(1, json_decode($this->get('game/quests', ['lat' => 53.1, 'lon' => 57.2, 'limit' => 1])->getJSON(), true)['count']);
        $this->assertSame(['user1'], array_column(json_decode($this->get('game/quests/' . $id)->getJSON(), true)['walkers'], 'id'));

        // A draft is the administrators' alone
        $this->signIn('admin1');
        $this->withBodyFormat('json')->patch('game/quests/' . $id, ['status' => 'draft'])->assertStatus(200);
        $this->signIn('user1');
        $this->get('game/quests/' . $id)->assertStatus(404);
        $this->assertSame(0, json_decode($this->get('game/quests')->getJSON(), true)['count']);
    }

    public function testAPhotoQuestShowsTheFirstPhotoOfThePointInPlaceOfThePlace(): void
    {
        // The riddle is the first photo of the place: the earliest one, whole
        $this->photo('photo1b', 'place1', 'user1', self::NEAR, '2026-01-02 10:00:00');
        $this->db->table('photos')->where('id', 'photo1b')->update(['created_at' => '2026-01-02 10:00:00']);
        $this->photo('photo1a', 'place1', 'user1', self::NEAR, '2026-01-01 10:00:00');
        $this->db->table('photos')->where('id', 'photo1a')->update(['created_at' => '2026-01-01 10:00:00']);

        $this->signIn('admin1');
        $quest = [
            'titleRu' => 'Фотоквест',
            'mode'    => 'photos',
            'status'  => 'published',
            'points'  => [['place' => 'place1'], ['place' => 'place2']],
        ];

        // Only places with a photo of their own
        $refused = json_decode($this->withBodyFormat('json')->post('game/quests', $quest)->getJSON(), true);
        $this->assertSame(lang('Game.photoPointsNoPhoto'), $refused['messages']['points']);

        $this->photo('photo2', 'place2', 'user1', ['lat' => 53.3, 'lon' => 57.3], '2026-01-01 10:00:00');
        $id = json_decode($this->withBodyFormat('json')->post('game/quests', $quest)->getJSON(), true)['id'];

        $this->signIn('user1');
        $this->withBodyFormat('json')->post("game/quests/{$id}/start")->assertStatus(200);
        $item = json_decode($this->get('game/quests/' . $id)->getJSON(), true);

        // The photo of the current point, not its place; nothing of the next one
        $this->assertSame(PATH_PHOTOS . 'place1/photo1a.jpg', $item['items'][0]['photo']['full']);
        $this->assertSame(PATH_PHOTOS . 'place1/photo1a_preview.jpg', $item['items'][0]['photo']['preview']);
        $this->assertArrayNotHasKey('place', $item['items'][0]);
        $this->assertArrayNotHasKey('photo', $item['items'][1]);
        $this->assertArrayNotHasKey('place', $item['items'][1]);
        // Secret as a riddle quest: on no map, no distance in a far check-in
        $this->assertSame([], json_decode($this->get('game/quests/marks')->getJSON(), true)['items']);
        $far = json_decode($this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::FAR)->getJSON(), true);
        $this->assertSame(lang('Game.photoFar'), $far['messages']['error']);

        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(200);

        // Found: the place is shown, the next point's photo is sent
        $item = json_decode($this->get('game/quests/' . $id)->getJSON(), true);
        $this->assertSame('place1', $item['items'][0]['place']['id']);
        $this->assertArrayNotHasKey('photo', $item['items'][0]);
        $this->assertSame(PATH_PHOTOS . 'place2/photo2.jpg', $item['items'][1]['photo']['full']);
        // Its visit is hidden from everyone else until the walk is over
        $this->signIn('user2');
        $this->assertSame(0, json_decode($this->get('visits', ['place' => 'place1'])->getJSON(), true)['count']);
    }

    public function testAQuestBecomesAPhotoQuestOnlyWithPhotosOfAllItsPlaces(): void
    {
        $this->photo('photo1', 'place1', 'user1', self::NEAR, '2026-01-01 10:00:00');

        $this->signIn('admin1');
        $id = json_decode($this->withBodyFormat('json')->post('game/quests', [
            'titleRu' => 'Открытый',
            'mode'    => 'open',
            'points'  => [['place' => 'place1'], ['place' => 'place2']],
        ])->getJSON(), true)['id'];

        $this->withBodyFormat('json')->patch('game/quests/' . $id, ['mode' => 'photos'])->assertStatus(400);
        $this->assertSame('open', $this->db->table('quests')->where('id', $id)->get()->getRow()->mode);

        $this->photo('photo2', 'place2', 'user1', ['lat' => 53.3, 'lon' => 57.3], '2026-01-01 10:00:00');
        $this->withBodyFormat('json')->patch('game/quests/' . $id, ['mode' => 'photos'])->assertStatus(200);
    }

    public function testAQuestIsEditedInOneLanguageAndKeepsTheOther(): void
    {
        $this->signIn('admin1');

        // Made on the English site: an English title is enough
        $id = json_decode($this->withBodyFormat('json')->post('game/quests', [
            'titleEn' => 'Waterfalls',
            'mode'    => 'steps',
            'points'  => [['place' => 'place1', 'hintEn' => 'By the water'], ['place' => 'place2']],
        ])->getJSON(), true)['id'];

        // A bot sends both languages at once
        $this->withBodyFormat('json')->patch('game/quests/' . $id, [
            'titleRu' => 'Водопады', 'titleEn' => 'Waterfalls',
            'points'  => [['place' => 'place1', 'hintRu' => 'У воды', 'hintEn' => 'By the water'], ['place' => 'place2']],
        ])->assertStatus(200);

        // The Russian site sends Russian only: the English texts stay
        $this->withBodyFormat('json')->patch('game/quests/' . $id, [
            'titleRu' => 'Водопады Урала',
            'points'  => [['place' => 'place1', 'hintRu' => 'Под водой'], ['place' => 'place2', 'hintRu' => null]],
        ])->assertStatus(200);

        $quest = $this->db->table('quests')->where('id', $id)->get()->getRow();
        $this->assertSame('Водопады Урала', $quest->title_ru);
        $this->assertSame('Waterfalls', $quest->title_en);

        $hints = $this->db->table('quests_points')->select('hint_ru, hint_en')->where('quest_id', $id)->orderBy('position')->get()->getResult();
        $this->assertSame(['Под водой', 'By the water'], [$hints[0]->hint_ru, $hints[0]->hint_en]);

        // A title can be emptied only while the other language has one
        $this->withBodyFormat('json')->patch('game/quests/' . $id, ['titleEn' => ''])->assertStatus(200);
        $this->withBodyFormat('json')->patch('game/quests/' . $id, ['titleRu' => ''])->assertStatus(400);
    }

    public function testARiddleQuestKeepsItsPlacesAndVisitsSecretUntilItIsWalked(): void
    {
        $this->signIn('admin1');
        $id = json_decode($this->withBodyFormat('json')->post('game/quests', [
            'titleRu' => 'Загадки',
            'mode'    => 'riddles',
            'status'  => 'published',
            'points'  => [['place' => 'place1', 'hintRu' => 'Где падает вода'], ['place' => 'place2', 'hintRu' => 'Где помнят']],
        ])->getJSON(), true)['id'];

        $this->signIn('user1');
        $this->withBodyFormat('json')->post("game/quests/{$id}/start")->assertStatus(200);
        $body = $this->get('game/quests/' . $id)->getJSON();

        // The riddle, not its answer: no place of the quest is in the answer or the list
        $this->assertSame('Где падает вода', json_decode($body, true)['items'][0]['hint']);
        $this->assertStringNotContainsString('place1', $body);
        $this->assertStringNotContainsString('Где помнят', $body);
        $this->assertStringNotContainsString('place1', $this->get('game/quests')->getJSON());
        // The list has nothing for a map: neither the cover nor the start of its first point, nor
        // its zone
        $listed = json_decode($this->get('game/quests')->getJSON(), true)['items'][0];
        $this->assertArrayNotHasKey('cover', $listed);
        $this->assertArrayNotHasKey('start', $listed);
        $this->assertArrayNotHasKey('zone', $listed);
        // Its own page has the search zone: a circle that holds both points with its centre on
        // neither of them
        $item = json_decode($this->get('game/quests/' . $id)->getJSON(), true);
        $this->assertArrayNotHasKey('start', $item);
        $this->assertGreaterThanOrEqual(500, $item['zone']['radius']);

        foreach ($this->db->table('places')->select('lat, lon')->whereIn('id', ['place1', 'place2'])->get()->getResult() as $place) {
            $distance = GameLibrary::distance($item['zone']['lat'], $item['zone']['lon'], (float) $place->lat, (float) $place->lon);
            $this->assertLessThan($item['zone']['radius'], $distance);
            $this->assertGreaterThan(0, $distance);
        }

        // Not on the maps at all: its zone is drawn on its own page only
        $this->assertSame([], json_decode($this->get('game/quests/marks')->getJSON(), true)['items']);

        // Not there: no distance in the refusal, it would be a hint
        $far = json_decode($this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::FAR)->getJSON(), true);
        $this->assertStringNotContainsString('км', $far['messages']['error']);

        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(200);

        // Found: the place is shown to the walker; the visit is hidden from everyone else
        $quest = json_decode($this->get('game/quests/' . $id)->getJSON(), true);
        $this->assertSame('place1', $quest['items'][0]['place']['id']);
        $this->assertSame('Где помнят', $quest['items'][1]['hint']);
        $this->assertSame(1, json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true)['count']);

        // The walker's own explored share counts it; nobody else's view of it does
        $this->assertCount(1, json_decode($this->get('game/exploration')->getJSON(), true)['regions']);

        $this->signIn('user2');
        $this->assertSame([], json_decode($this->get('game/recent')->getJSON(), true)['items']);
        $this->assertSame([], json_decode($this->get('game/exploration', ['user' => 'user1'])->getJSON(), true)['regions']);
        $this->assertSame(0, json_decode($this->get('visits', ['place' => 'place1'])->getJSON(), true)['count']);
        $this->assertSame(0, json_decode($this->get('visits', ['user' => 'user1'])->getJSON(), true)['count']);
        $this->assertSame(0, $this->db->table('activity')->where('type', 'visit')->countAllResults());

        // The walk is over: the visits are shown and logged
        $this->signIn('user1');
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", ['lat' => 53.3, 'lon' => 57.3])->assertStatus(200);

        $this->signIn('user2');
        $this->assertSame(1, json_decode($this->get('visits', ['place' => 'place1'])->getJSON(), true)['count']);
        $this->assertSame(2, $this->db->table('activity')->where('type', 'visit')->countAllResults());
        $this->assertSame(0, $this->db->table('users_visited_places')->where('hidden', 1)->countAllResults());
    }

    public function testAnOpenQuestTakesItsPointsInAnyOrderAndFromAPhoto(): void
    {
        $this->db->table('achievements')->insert([
            'id' => 'wayfarer1', 'group_slug' => 'wayfarer', 'type' => 'base', 'tier' => 'bronze', 'category' => 'game',
            'title_en' => 'Wayfarer', 'title_ru' => 'Путник', 'rules' => json_encode([['metric' => 'quests_walked', 'operator' => '>=', 'value' => 1]]),
            'xp_bonus' => 30, 'sort_order' => 1, 'is_active' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->signIn('admin1');
        $id = json_decode($this->withBodyFormat('json')->post('game/quests', [
            'titleRu' => 'Открытый',
            'mode'    => 'open',
            'status'  => 'published',
            'points'  => [['place' => 'place1'], ['place' => 'place2']],
        ])->getJSON(), true)['id'];

        $this->signIn('user1');
        $quest = json_decode($this->get('game/quests/' . $id)->getJSON(), true);

        $this->assertSame(['open', 'open'], array_column($quest['items'], 'state'));
        $this->assertSame('place2', $quest['items'][1]['place']['id']);
        $this->assertSame(20, $quest['items'][1]['value']);

        // A photo shot at a point of a quest nobody began begins nothing
        $this->withBodyFormat('json')->post('game/confirm', ['place' => 'place3', 'lat' => 51.7, 'lon' => 55.1])->assertStatus(200);
        $this->assertSame(0, $this->db->table('quests_walks')->countAllResults());
        $this->withBodyFormat('json')->post("game/quests/{$id}/start")->assertStatus(200);

        // The second point first: the nearest one still to confirm is taken
        $step = json_decode($this->withBodyFormat('json')->post("game/quests/{$id}/confirm", ['lat' => 53.3, 'lon' => 57.3])->getJSON(), true);
        $this->assertSame('place2', $step['place']);

        // The first one by a photo shot there: the walk takes it too, and is over
        $user  = $this->db->table('users')->where('id', 'user1')->get()->getRow();
        $place = $this->db->table('places')->where('id', 'place1')->get()->getRow();
        $this->photo('photo1', 'place1', 'user1', self::NEAR, date('Y-m-d') . ' 10:00:00');
        (new GameLibrary())->photoUploaded($user, $place, 'photo1', (object) self::NEAR, date('Y-m-d') . ' 10:00:00');

        $quest = json_decode($this->get('game/quests/' . $id)->getJSON(), true);

        $this->assertSame(['done', 'done'], array_column($quest['items'], 'state'));
        $this->assertNotNull($quest['walk']['finished']);
        // 40 (the cave) + 20 + 45 for the places; the quest itself adds nothing to the season
        $this->assertSame(105, (new GameLibrary())->total('user1', GameLibrary::seasonOf(date('Y-m-d'))['id']));
        $this->assertSame(1, $this->db->table('users_achievements')->where(['user_id' => 'user1', 'achievement_id' => 'wayfarer1'])->countAllResults());

        // A person in the game, for their profile
        $profile = json_decode($this->get('game/users/user1')->getJSON(), true);

        $this->assertSame(105, $profile['points']);
        $this->assertSame(1, $profile['place']);
        $this->assertSame(3, $profile['confirmed']);
        $this->assertSame(1, $profile['walked']);

        // A removed point goes from the walks; the kept one keeps its confirmation
        $this->signIn('admin1');
        $this->withBodyFormat('json')->patch('game/quests/' . $id, ['points' => [['place' => 'place3'], ['place' => 'place1']]])->assertStatus(200);
        $edit = json_decode($this->get('game/quests/' . $id, ['edit' => 1])->getJSON(), true);
        $this->assertSame(['place3', 'place1'], array_map(static fn (array $item) => $item['place']['id'], $edit['items']));
        $this->assertSame(1, $this->db->table('quests_walks_points')->countAllResults());

        $this->delete('game/quests/' . $id)->assertStatus(200);
        $this->get('game/quests/' . $id)->assertStatus(404);
    }

    public function testAWalkIsOverWhenThePointsLeftAreGoneFromTheQuest(): void
    {
        $this->signIn('admin1');
        $id = json_decode($this->withBodyFormat('json')->post('game/quests', [
            'titleRu' => 'Три точки',
            'mode'    => 'steps',
            'status'  => 'published',
            'points'  => [['place' => 'place1'], ['place' => 'place2'], ['place' => 'place3']],
        ])->getJSON(), true)['id'];

        $this->signIn('user1');
        $this->withBodyFormat('json')->post("game/quests/{$id}/start")->assertStatus(200);
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(200);

        // The place of the second point is deleted: the third one is the next
        $this->db->table('places')->where('id', 'place2')->update(['deleted_at' => date('Y-m-d H:i:s')]);

        $quest = json_decode($this->get('game/quests/' . $id)->getJSON(), true);
        $this->assertSame(['done', 'current'], array_column($quest['items'], 'state'));
        $this->assertSame('place3', $quest['items'][1]['place']['id']);

        // The third one is removed by the editor: nothing is left to confirm, the walk is over
        $this->signIn('admin1');
        $this->withBodyFormat('json')->patch('game/quests/' . $id, ['points' => [['place' => 'place1'], ['place' => 'place3']]])->assertStatus(200);
        $this->db->table('places')->where('id', 'place3')->update(['deleted_at' => date('Y-m-d H:i:s')]);

        $this->signIn('user1');
        $this->withBodyFormat('json')->post("game/quests/{$id}/confirm", self::NEAR)->assertStatus(400);

        $walk = $this->db->table('quests_walks')->where('user_id', 'user1')->get()->getRow();
        $this->assertNotNull($walk->finished_at);
        $this->assertSame(1, (int) $this->db->table('quests')->where('id', $id)->get()->getRow()->walked);
    }

    /** An award counting a metric: limited to a window when the dates are given */
    private function award(string $id, string $metric, int $value, ?string $from = null, ?string $to = null): void
    {
        $this->db->table('achievements')->insert([
            'id' => $id, 'group_slug' => $id, 'type' => $from ? 'seasonal' : 'base', 'tier' => 'none', 'category' => 'exploration',
            'title_en' => 'Award ' . $id, 'title_ru' => 'Награда ' . $id,
            'rules' => json_encode([['metric' => $metric, 'operator' => '>=', 'value' => $value]]),
            'season_start' => $from, 'season_end' => $to,
            'xp_bonus' => 0, 'sort_order' => 1, 'is_active' => 1, 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private function place(string $id, string $category, float $lat, float $lon, int $regionId): void
    {
        $this->db->table('places')->insert([
            'id' => $id, 'user_id' => 'admin1', 'category' => $category, 'lat' => $lat, 'lon' => $lon, 'slug' => $id,
            'country_id' => 1, 'region_id' => $regionId,
        ]);
        $this->db->table('places_content')->insert([
            'id' => 'text-' . $id, 'place_id' => $id, 'user_id' => 'admin1', 'locale' => 'ru', 'title' => 'Место ' . $id, 'content' => 'Текст.',
        ]);
    }

    /**
     * @param array{lat: float, lon: float} $position
     */
    private function photo(string $id, string $placeId, string $userId, array $position, string $takenAt): void
    {
        $this->db->table('photos')->insert([
            'id' => $id, 'place_id' => $placeId, 'user_id' => $userId, 'lat' => $position['lat'], 'lon' => $position['lon'],
            'gps' => 1, 'taken_at' => $takenAt, 'filename' => $id, 'extension' => 'jpg', 'filesize' => 1, 'width' => 1, 'height' => 1,
        ]);
    }
}
