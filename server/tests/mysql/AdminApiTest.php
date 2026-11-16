<?php

require_once __DIR__ . '/../_support/UploadFunctions.php';

use App\Libraries\GameLibrary;
use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * The admin API of the game's seasons, the achievements and the mail queue: who may use it,
 * what it accepts, and what it leaves behind.
 *
 * @internal
 */
final class AdminApiTest extends MySqlTestCase
{
    use FeatureTestTrait;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    /** @var string[] files the test made under public/uploads, taken away after it */
    private array $made = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('admin1', ['role' => 'admin']);
        $this->createUser('user1');
        $this->createUser('user2');

        foreach (['place1', 'place2'] as $id) {
            $this->db->table('places')->insert(['id' => $id, 'user_id' => 'admin1', 'category' => 'cave', 'lat' => 53.1, 'lon' => 57.2, 'slug' => $id]);
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->made as $path) {
            @unlink(FCPATH . $path);
        }

        $this->made = [];

        service('superglobals')->setFilesArray([]);
        service('superglobals')->setPostArray([]);

        parent::tearDown();
    }

    // ------------------------------------------------------------------ seasons

    public function testASeasonCannotBeCalledManage(): void
    {
        $this->signIn('admin1');

        foreach (['manage', 'leaders', 'new'] as $id) {
            $answer = $this->createSeasonRequest(['id' => $id]);

            $this->assertSame(400, $answer['status'], $id);
            $this->assertArrayHasKey('id', $answer['body']['messages']);
        }

        $this->assertSame(0, $this->db->table('game_seasons')->countAllResults());

        // The list stays where it was
        $this->get('game/seasons/manage')->assertStatus(200);
    }

    public function testTheSameIdTwiceIsA400OnTheId(): void
    {
        $this->signIn('admin1');

        $this->assertSame(201, $this->createSeasonRequest(['id' => 'one-one'])['status']);

        $second = $this->createSeasonRequest(['id' => 'one-one', 'starts_on' => '2032-01-01', 'ends_on' => '2032-02-01']);

        $this->assertSame(400, $second['status']);
        $this->assertArrayHasKey('id', $second['body']['messages']);
        $this->assertSame(1, $this->db->table('game_seasons')->countAllResults());
    }

    public function testASeasonChangeWaitsForTheLockAndAsksToRetry(): void
    {
        $this->signIn('admin1');

        // Another process is changing the seasons: this request writes nothing and says so
        $other = \Config\Database::connect('tests', false);
        $this->assertSame(1, (int) $other->query("SELECT GET_LOCK('game_seasons', 1) AS l")->getRow()->l);

        try {
            $answer = $this->createSeasonRequest(['id' => 'locked']);
        } finally {
            $other->query("SELECT RELEASE_LOCK('game_seasons')");
            $other->close();
        }

        $this->assertSame(400, $answer['status']);
        $this->assertArrayHasKey('error', $answer['body']['messages']);
        $this->assertSame(0, $this->db->table('game_seasons')->countAllResults());
        $this->assertSame(201, $this->createSeasonRequest(['id' => 'locked'])['status']);
    }

    public function testABusyLockOnAChangeOrADeleteIsA400NotA404(): void
    {
        $this->season('busy', GameLibrary::today(null, '+10 days'), GameLibrary::today(null, '+40 days'));
        $this->signIn('admin1');

        $other = \Config\Database::connect('tests', false);
        $this->assertSame(1, (int) $other->query("SELECT GET_LOCK('game_seasons', 1) AS l")->getRow()->l);

        try {
            $patch  = $this->withBodyFormat('json')->patch('game/seasons/busy', ['title_ru' => 'Другое']);
            $delete = $this->delete('game/seasons/busy');
        } finally {
            $other->query("SELECT RELEASE_LOCK('game_seasons')");
            $other->close();
        }

        foreach ([$patch, $delete] as $answer) {
            $answer->assertStatus(400);
            $this->assertArrayHasKey('error', json_decode($answer->getJSON(), true)['messages']);
        }

        $this->assertSame(1, $this->db->table('game_seasons')->where('id', 'busy')->countAllResults());
    }

    public function testASeasonWithPointsKeepsItsStartAndItsLastCountedDays(): void
    {
        $today = GameLibrary::today();
        $this->season('play', GameLibrary::today(null, '-30 days'), GameLibrary::today(null, '+30 days'));
        $this->points('play', 'user1', 'place1', GameLibrary::today(null, '-5 days') . ' 12:00:00');
        $this->signIn('admin1');

        $patch = fn (array $body) => $this->withBodyFormat('json')->patch('game/seasons/play', $body);
        $msg   = fn (array $body) => json_decode($patch($body)->getJSON(), true)['messages'] ?? [];

        // The start cannot move, whichever way
        $this->assertArrayHasKey('starts_on', $msg(['starts_on' => GameLibrary::today(null, '-40 days')]));
        $this->assertArrayHasKey('starts_on', $msg(['starts_on' => GameLibrary::today(null, '+1 day')]));

        // The end cannot go before the latest counted day, nor before today
        $this->assertArrayHasKey('ends_on', $msg(['ends_on' => GameLibrary::today(null, '-6 days')]));
        $this->assertArrayHasKey('ends_on', $msg(['ends_on' => GameLibrary::today(null, '-3 days')]));
        $this->assertSame('play', $this->db->table('game_seasons')->where('id', 'play')->get()->getRow()->id);
        $this->assertSame(GameLibrary::today(null, '+30 days'), $this->db->table('game_seasons')->where('id', 'play')->get()->getRow()->ends_on);

        // Today is allowed, a later end is allowed; the texts are free, and the same dates sent again are no change
        $patch(['ends_on' => $today])->assertStatus(200);
        $patch(['ends_on' => GameLibrary::today(null, '+60 days')])->assertStatus(200);
        $patch(['title_ru' => 'Другое', 'starts_on' => GameLibrary::today(null, '-30 days')])->assertStatus(200);
    }

    public function testASeasonWithoutPointsHasFreeDates(): void
    {
        $this->season('empty', GameLibrary::today(null, '-30 days'), GameLibrary::today(null, '+30 days'));
        $this->signIn('admin1');

        $this->withBodyFormat('json')->patch('game/seasons/empty', ['starts_on' => GameLibrary::today(null, '+1 day'), 'ends_on' => GameLibrary::today(null, '+2 days')])->assertStatus(200);
    }

    public function testASeasonPastItsGraceDaysCannotBeReopenedBeforeTheTick(): void
    {
        // Ended long ago, not ticked yet: moving its end would bring it back to life
        $this->season('stale', GameLibrary::today(null, '-60 days'), GameLibrary::today(null, '-30 days'));
        $this->points('stale', 'user1', 'place1', GameLibrary::today(null, '-40 days') . ' 12:00:00');
        $this->signIn('admin1');

        $this->withBodyFormat('json')->patch('game/seasons/stale', ['ends_on' => GameLibrary::today(null, '+5 days')])->assertStatus(400);
        $this->withBodyFormat('json')->patch('game/seasons/stale', ['title_en' => 'Stale'])->assertStatus(200);
        $this->assertNull((new GameLibrary())->find('stale')['closed_at']);
    }

    public function testASeasonWithPointsIsNotDeletedAndOneWithoutIs(): void
    {
        $this->season('played', GameLibrary::today(null, '-10 days'), GameLibrary::today(null, '+10 days'));
        $this->points('played', 'user1', 'place1', GameLibrary::today() . ' 12:00:00');
        $this->season('unplayed', GameLibrary::today(null, '+20 days'), GameLibrary::today(null, '+30 days'));
        $this->signIn('admin1');

        $this->delete('game/seasons/played')->assertStatus(400);
        $this->assertNotNull((new GameLibrary())->find('played'));
        $this->delete('game/seasons/unplayed')->assertStatus(200);
        $this->assertNull((new GameLibrary())->find('unplayed'));
    }

    public function testTheOptionalTextsOfASeasonAreStringsOrNull(): void
    {
        $this->signIn('admin1');

        foreach (['title_en', 'description_ru', 'description_en'] as $field) {
            $answer = $this->createSeasonRequest(['id' => 'texts', $field => ['no']]);

            $this->assertSame(400, $answer['status'], $field);
            $this->assertArrayHasKey($field, $answer['body']['messages']);
        }

        $this->assertSame(201, $this->createSeasonRequest(['id' => 'texts', 'title_en' => null, 'description_ru' => ''])['status']);
        $this->season('has-text', GameLibrary::today(null, '+400 days'), GameLibrary::today(null, '+410 days'), ['description_ru' => 'Описание']);
        // A number does not clear the text
        $this->withBodyFormat('json')->patch('game/seasons/has-text', ['description_ru' => 5])->assertStatus(400);
        $this->assertSame('Описание', (new GameLibrary())->find('has-text')['description_ru']);
    }

    public function testAMalformedBodyIsA400NotA500(): void
    {
        $this->signIn('admin1');
        $this->season('body', GameLibrary::today(null, '+400 days'), GameLibrary::today(null, '+410 days'));

        foreach (['{bad json', '"just a string"', '[1,2,3]', '42'] as $body) {
            $this->withBodyFormat('json')->withBody($body)->post('game/seasons')->assertStatus(400);
            $this->withBodyFormat('json')->withBody($body)->patch('game/seasons/body')->assertStatus(400);
        }
    }

    public function testTheListOfSeasonsCountsThePointsOfEach(): void
    {
        $this->season('a-one', GameLibrary::today(null, '-50 days'), GameLibrary::today(null, '-40 days'));
        $this->season('b-two', GameLibrary::today(null, '-30 days'), GameLibrary::today(null, '+30 days'));
        $this->season('c-three', GameLibrary::today(null, '+40 days'), GameLibrary::today(null, '+50 days'));
        $this->points('a-one', 'user1', 'place1', GameLibrary::today(null, '-45 days') . ' 12:00:00');
        $this->points('b-two', 'user1', 'place1', GameLibrary::today() . ' 12:00:00');
        $this->points('b-two', 'user2', 'place1', GameLibrary::today() . ' 13:00:00');
        $this->signIn('admin1');

        $items = json_decode($this->get('game/seasons/manage')->getJSON(), true)['items'];

        $this->assertSame(['c-three' => 0, 'b-two' => 2, 'a-one' => 1], array_column($items, 'points', 'id'));
    }

    public function testTheTickClosesASeasonOnlyAfterItsLastDay(): void
    {
        $game  = new GameLibrary();
        $grace = config(\Config\Game::class)->graceDays;

        // Today is the last day it takes confirmations: still open
        $this->season('edge', GameLibrary::today(null, '-100 days'), GameLibrary::today(null, "-{$grace} days"));
        $this->assertSame([], $game->tick());
        $this->assertNull($game->find('edge')['closed_at']);

        // A day later it closes, without a player too
        $this->db->table('game_seasons')->where('id', 'edge')->update(['ends_on' => GameLibrary::today(null, '-' . ($grace + 1) . ' days')]);
        $this->assertSame(['edge'], $game->tick());

        $row = $this->db->table('game_seasons')->where('id', 'edge')->get()->getRow();
        $this->assertNotNull($row->closed_at);
        $this->assertSame(0, (int) $row->players);
        $this->assertSame(0, $this->db->table('game_results')->countAllResults());

        // The second run does nothing
        $this->assertSame([], $game->tick());
        $this->assertSame($row->closed_at, $this->db->table('game_seasons')->where('id', 'edge')->get()->getRow()->closed_at);
    }

    public function testTheTickFreezesTheTableItHoldsAndNothingCountsAfterTheClose(): void
    {
        $game = new GameLibrary();
        $past = $this->season('frozen', GameLibrary::today(null, '-100 days'), GameLibrary::today(null, '-50 days'));
        $this->points('frozen', 'user1', 'place1', GameLibrary::today(null, '-60 days') . ' 12:00:00', 30);
        $this->points('frozen', 'user2', 'place1', GameLibrary::today(null, '-60 days') . ' 13:00:00', 20);

        $this->assertSame(['frozen'], $game->tick());
        $this->assertSame(['user1', 'user2'], array_column($this->db->table('game_results')->orderBy('place')->get()->getResultArray(), 'user_id'));

        // A check-in that was under way finds the season closed: no point is written to it
        $place = (object) ['id' => 'place2', 'category' => 'cave', 'user_id' => null, 'created_at' => null];
        $score = new ReflectionMethod($game, 'score');
        $score->setAccessible(true);

        $this->assertSame([0, null], $score->invoke($game, 'user2', $place, $past, GameLibrary::WAY_GEO, 'visit-x', null, GameLibrary::today(null, '-60 days')));
        $this->assertSame(2, $this->db->table('game_points')->countAllResults());
    }

    public function testACheckInWhoseDayTheSeasonNoLongerHoldsCountsNowhere(): void
    {
        $game   = new GameLibrary();
        $season = $this->season('now', GameLibrary::today(null, '-10 days'), GameLibrary::today(null, '+10 days'));
        $place  = (object) ['id' => 'place2', 'category' => 'cave', 'user_id' => null, 'created_at' => null];
        $score  = new ReflectionMethod($game, 'score');
        $score->setAccessible(true);

        // The administrator moved the start past the day while the check-in was under way
        $this->db->table('game_seasons')->where('id', $season['id'])->update(['starts_on' => GameLibrary::today(null, '+1 day')]);

        $this->assertSame([0, null], $score->invoke($game, 'user2', $place, $season, GameLibrary::WAY_GEO, 'visit-x', null, GameLibrary::today()));
        $this->assertSame(0, $this->db->table('game_points')->where('place_id', 'place2')->countAllResults());
    }

    public function testAClosedSeasonWithoutAFrozenLineGivesNoMedal(): void
    {
        $this->season('shut', GameLibrary::today(null, '-100 days'), GameLibrary::today(null, '-50 days'), ['closed_at' => GameLibrary::today(null, '-40 days') . ' 00:00:00']);
        $this->points('shut', 'user1', 'place1', GameLibrary::today(null, '-60 days') . ' 12:00:00');

        $items = (new GameLibrary())->participations('user1');

        $this->assertCount(1, $items);
        $this->assertTrue($items[0]['closed']);
        $this->assertNull($items[0]['place']);
        $this->assertNull($items[0]['medal']);
        $this->assertNull($items[0]['medalImage']);
    }

    public function testTheSeasonsGuardAnswers401ToAGuestAnd403ToAMember(): void
    {
        $this->season('guard', GameLibrary::today(null, '+400 days'), GameLibrary::today(null, '+410 days'));

        $calls = fn () => [
            $this->get('game/seasons/manage'),
            $this->get('game/seasons/manage/guard'),
            $this->withBodyFormat('json')->post('game/seasons', []),
            $this->withBodyFormat('json')->patch('game/seasons/guard', []),
            $this->delete('game/seasons/guard'),
            $this->post('game/seasons/guard/image'),
            $this->delete('game/seasons/guard/image'),
        ];

        foreach ($calls() as $response) {
            $response->assertStatus(401);
            $this->assertArrayHasKey('error', json_decode($response->getJSON(), true)['messages']);
        }

        $this->signIn('user1');

        foreach ($calls() as $response) {
            $response->assertStatus(403);
        }
    }

    public function testASeasonPictureIsPngOrAnHonestSvg(): void
    {
        $this->season('pics', GameLibrary::today(null, '+400 days'), GameLibrary::today(null, '+410 days'));
        $this->signIn('admin1');

        // A PNG
        $first = $this->upload('game/seasons/pics/image', $this->tempFile(base64_decode(self::PNG), 'png'), 'image/png', ['kind' => 'gold']);
        $first->assertStatus(200);
        $gold = json_decode($first->getJSON(), true)['medals']['gold'];
        $this->made[] = $gold;

        $this->assertMatchesRegularExpression('#^uploads/seasons/pics_gold_\d+_[0-9a-f]{6}\.png$#', $gold);
        $this->assertFileExists(FCPATH . $gold);

        // An SVG without the XML prologue replaces it; the old file goes
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>';
        $second = $this->upload('game/seasons/pics/image', $this->tempFile($svg, 'svg'), 'image/svg+xml', ['kind' => 'gold']);
        $second->assertStatus(200);
        $newGold = json_decode($second->getJSON(), true)['medals']['gold'];
        $this->made[] = $newGold;

        $this->assertStringEndsWith('.svg', $newGold);
        $this->assertFileExists(FCPATH . $newGold);
        $this->assertFileDoesNotExist(FCPATH . $gold);

        // Taking it off deletes the file
        $this->delete('game/seasons/pics/image?kind=gold')->assertStatus(200);
        $this->assertFileDoesNotExist(FCPATH . $newGold);
    }

    public function testTheMedalOfAQuestIsStoredReplacedAndTakenOff(): void
    {
        $this->db->table('quests')->insert([
            'id' => 'quest1', 'mode' => 'open', 'status' => 'published', 'title_ru' => 'Квест', 'user_id' => 'admin1',
            'length_m' => 0, 'points' => 0, 'walked' => 0, 'created_at' => date('Y-m-d H:i:s'),
        ]);

        // Only an administrator
        $this->signIn('user1');
        $this->upload('game/quests/quest1/medal', $this->tempFile(base64_decode(self::PNG), 'png'), 'image/png')->assertStatus(403);

        $this->signIn('admin1');
        $first = $this->upload('game/quests/quest1/medal', $this->tempFile(base64_decode(self::PNG), 'png'), 'image/png');
        $first->assertStatus(200);
        $medal = json_decode($first->getJSON(), true)['medal'];
        $this->made[] = $medal;

        $this->assertMatchesRegularExpression('#^uploads/quests/quest1_\d+_[0-9a-f]{6}\.png$#', $medal);
        $this->assertFileExists(FCPATH . $medal);
        $this->assertSame($medal, json_decode($this->get('game/quests/quest1')->getJSON(), true)['medal']);

        // A new one replaces it and the old file goes
        $svg    = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>';
        $second = json_decode($this->upload('game/quests/quest1/medal', $this->tempFile($svg, 'svg'), 'image/svg+xml')->getJSON(), true)['medal'];
        $this->made[] = $second;

        $this->assertFileDoesNotExist(FCPATH . $medal);

        // Unsafe content is refused
        $this->upload('game/quests/quest1/medal', $this->tempFile('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>', 'svg'), 'image/svg+xml')->assertStatus(400);

        // Taken off: the file goes, the quest has no medal
        $this->delete('game/quests/quest1/medal')->assertStatus(200);
        $this->assertFileDoesNotExist(FCPATH . $second);
        $this->assertNull(json_decode($this->get('game/quests/quest1')->getJSON(), true)['medal']);
    }

    public function testAnUnsafeOrOversizedSeasonPictureIsRefused(): void
    {
        $this->season('bad', GameLibrary::today(null, '+400 days'), GameLibrary::today(null, '+410 days'));
        $this->signIn('admin1');

        $bad = [
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"/></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
            '<?php echo 1; ?>',
        ];

        foreach ($bad as $content) {
            $this->upload('game/seasons/bad/image', $this->tempFile($content, 'svg'), 'image/svg+xml', ['kind' => 'participant'])->assertStatus(400);
        }

        // Over a megabyte
        $big = base64_decode(self::PNG) . str_repeat("\0", 1024 * 1024);
        $this->upload('game/seasons/bad/image', $this->tempFile($big, 'png'), 'image/png', ['kind' => 'participant'])->assertStatus(400);

        $this->assertNull((new GameLibrary())->find('bad')['image']);
    }

    // ------------------------------------------------------------------ achievements

    public function testTheAchievementsGuardAnswers401ToAGuestAnd403ToAMember(): void
    {
        $this->award('ach1');

        $calls = fn () => [
            $this->get('achievements/manage'),
            $this->get('achievements/manage/recent'),
            $this->json('post', 'achievements', ['title_ru' => 'x']),
            $this->json('put', 'achievements/ach1', ['title_ru' => 'y']),
            $this->delete('achievements/ach1'),
            $this->post('achievements/ach1/image'),
        ];

        foreach ($calls() as $response) {
            $response->assertStatus(401);
        }

        $this->signIn('user1');

        foreach ($calls() as $response) {
            $response->assertStatus(403);
        }

        $this->assertSame(1, $this->db->table('achievements')->countAllResults());
    }

    public function testAnAchievementIsCreatedWithItsRulesStoredOnce(): void
    {
        $this->signIn('admin1');

        $created = $this->json('post', 'achievements', $this->achievementBody());
        $created->assertStatus(201);
        $answer = json_decode($created->getJSON(), true);

        $this->assertEquals([['metric' => 'places_confirmed', 'operator' => '>=', 'value' => 3]], $answer['rules']);

        $row = $this->db->query('SELECT rules, JSON_TYPE(rules) AS t FROM achievements')->getRow();
        $this->assertSame('ARRAY', $row->t);
        $this->assertEquals([['metric' => 'places_confirmed', 'operator' => '>=', 'value' => 3]], json_decode($row->rules, true));

        // The catalogue reads them as a list, the manage page too
        $manage = json_decode($this->get('achievements/manage')->getJSON(), true)['data'][0];
        $this->assertSame('places_confirmed', $manage['rules'][0]['metric']);

        // Defaults: a base award with no rules is an empty list
        $this->json('post', 'achievements', ['group_slug' => 'plain', 'category' => 'social', 'title_ru' => 'Простая'])->assertStatus(201);
        $this->assertSame('ARRAY', $this->db->query("SELECT JSON_TYPE(rules) AS t FROM achievements WHERE group_slug = 'plain'")->getRow()->t);
    }

    public function testAnAchievementIsCheckedBeforeItIsSaved(): void
    {
        $this->signIn('admin1');

        $bad = [
            'type'         => ['type' => 'weekly'],
            'tier'         => ['tier' => 'platinum'],
            'category'     => ['category' => 'nonsense'],
            'title_ru'     => ['title_ru' => '  '],
            'group_slug'   => ['group_slug' => 'a b'],
            'rules'        => ['rules' => [['metric' => 'made_up', 'value' => 1]]],
            'rules '       => ['rules' => 'text'],
            'rules  '      => ['rules' => [['metric' => 'places_confirmed', 'value' => 'many']]],
            'xp_bonus'     => ['xp_bonus' => -1],
            'sort_order'   => ['sort_order' => 'x'],
            'is_active'    => ['is_active' => 'maybe'],
            'image'        => ['image' => '../../.env'],
            'season_start' => ['season_start' => 'tomorrow'],
        ];

        foreach ($bad as $name => $change) {
            $answer = $this->json('post', 'achievements', $change + $this->achievementBody());

            $this->assertSame(400, $answer->response()->getStatusCode(), $name);
            $this->assertArrayHasKey(array_key_first($change), json_decode($answer->getJSON(), true)['messages'], $name);
        }

        // A seasonal award needs a window, the start not after the end
        $this->json('post', 'achievements', ['type' => 'seasonal'] + $this->achievementBody())->assertStatus(400);
        $this->json('post', 'achievements', ['type' => 'seasonal', 'season_start' => '2027-02-01', 'season_end' => '2027-01-01'] + $this->achievementBody())->assertStatus(400);

        $this->assertSame(0, $this->db->table('achievements')->countAllResults());

        // A good window: a bare end day lasts until its last second
        $ok = $this->json('post', 'achievements', ['type' => 'seasonal', 'season_start' => '2027-01-01', 'season_end' => '2027-01-31'] + $this->achievementBody());
        $ok->assertStatus(201);
        $row = $this->db->table('achievements')->get()->getRow();
        $this->assertSame('2027-01-01 00:00:00', $row->season_start);
        $this->assertSame('2027-01-31 23:59:59', $row->season_end);
    }

    public function testAnAchievementUpdateTakesKnownFieldsOnly(): void
    {
        $this->signIn('admin1');
        $id = json_decode($this->json('post', 'achievements', $this->achievementBody())->getJSON(), true)['id'];

        // Nothing, or nothing known: 400, not a 500
        $this->json('put', "achievements/{$id}", [])->assertStatus(400);
        $this->json('put', "achievements/{$id}", ['nonsense' => 1])->assertStatus(400);
        $this->withBodyFormat('json')->withBody('{bad')->put("achievements/{$id}")->assertStatus(400);
        $this->withBodyFormat('json')->withBody('"x"')->put("achievements/{$id}")->assertStatus(400);
        $this->withBodyFormat('json')->withBody('{bad')->post('achievements')->assertStatus(400);
        $this->withBodyFormat('json')->withBody('[1]')->post('achievements')->assertStatus(400);
        $this->json('put', "achievements/{$id}", ['tier' => 'platinum'])->assertStatus(400);
        $this->json('put', 'achievements/missing', ['tier' => 'gold'])->assertStatus(404);

        $changed = $this->json('put', "achievements/{$id}", ['tier' => 'silver', 'rules' => [['metric' => 'quests_walked', 'value' => 2]], 'is_active' => false]);
        $changed->assertStatus(200);
        $answer = json_decode($changed->getJSON(), true);

        $this->assertSame('silver', $answer['tier']);
        $this->assertSame('quests_walked', $answer['rules'][0]['metric']);
        $this->assertSame('ARRAY', $this->db->query('SELECT JSON_TYPE(rules) AS t FROM achievements')->getRow()->t);
        $this->assertSame(0, (int) $this->db->table('achievements')->get()->getRow()->is_active);

        // The filters the metrics read survive a save: one quest, a category of places
        $filtered = $this->json('put', "achievements/{$id}", ['rules' => [
            ['metric' => 'quests_walked', 'value' => 1, 'filter' => ['quest_id' => 'q1']],
            ['metric' => 'places_confirmed', 'value' => 2, 'filter' => ['category_id' => 'castle', 'tag_id' => 'gone']],
        ]]);
        $filtered->assertStatus(200);
        $rules = json_decode($filtered->getJSON(), true)['rules'];

        $this->assertSame(['quest_id' => 'q1'], $rules[0]['filter']);
        $this->assertSame(['category_id' => 'castle'], $rules[1]['filter']);

        // The season window of a base award is not required; sent back as the client reads it (a day)
        $this->json('put', "achievements/{$id}", ['season_start' => null])->assertStatus(200);
    }

    public function testAnAchievementPictureLeavesNoOrphanFiles(): void
    {
        $this->signIn('admin1');
        $id = json_decode($this->json('post', 'achievements', $this->achievementBody())->getJSON(), true)['id'];

        $one = json_decode($this->upload("achievements/{$id}/image", $this->tempFile(base64_decode(self::PNG), 'png'), 'image/png')->getJSON(), true)['image'];
        $this->made[] = $one;
        $this->assertFileExists(FCPATH . $one);

        // A second picture replaces it and takes the first file away
        sleep(1);
        $two = json_decode($this->upload("achievements/{$id}/image", $this->tempFile('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>', 'svg'), 'image/svg+xml')->getJSON(), true)['image'];
        $this->made[] = $two;
        $this->assertNotSame($one, $two);
        $this->assertFileExists(FCPATH . $two);
        $this->assertFileDoesNotExist(FCPATH . $one);

        // An unsafe one changes nothing
        $this->upload("achievements/{$id}/image", $this->tempFile('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>', 'svg'), 'image/svg+xml')->assertStatus(400);
        $this->assertSame($two, $this->db->table('achievements')->get()->getRow()->image);

        // Taking the picture off through the update removes the file; deleting the award removes its file too
        $this->json('put', "achievements/{$id}", ['image' => null])->assertStatus(200);
        $this->assertFileDoesNotExist(FCPATH . $two);

        $three = json_decode($this->upload("achievements/{$id}/image", $this->tempFile(base64_decode(self::PNG), 'png'), 'image/png')->getJSON(), true)['image'];
        $this->made[] = $three;
        $this->delete("achievements/{$id}")->assertStatus(200);
        $this->assertFileDoesNotExist(FCPATH . $three);
        $this->assertSame(0, $this->db->table('achievements')->countAllResults());
    }

    public function testRulesStoredTwiceByTheOldCreateAreMendedByTheMigration(): void
    {
        $this->award('legacy');
        $rules = json_encode([['metric' => 'places_confirmed', 'operator' => '>=', 'value' => 1]]);
        $this->db->table('achievements')->where('id', 'legacy')->update(['rules' => json_encode($rules)]);
        $this->assertSame('STRING', $this->db->query("SELECT JSON_TYPE(rules) AS t FROM achievements WHERE id = 'legacy'")->getRow()->t);

        require_once APPPATH . 'Database/Migrations/2026-11-15-000002_FixDoubleEncodedAchievementRules.php';
        (new \App\Database\Migrations\FixDoubleEncodedAchievementRules())->up();

        $row = $this->db->query("SELECT rules, JSON_TYPE(rules) AS t FROM achievements WHERE id = 'legacy'")->getRow();
        $this->assertSame('ARRAY', $row->t);
        $this->assertEquals(json_decode($rules, true), json_decode($row->rules, true));
    }

    // ------------------------------------------------------------------ sending mail

    public function testTheMailQueueGuardAnswers401ToAGuestAnd403ToAMember(): void
    {
        $this->get('sending-mail/manage')->assertStatus(401);
        $this->get('sending-mail/manage/any')->assertStatus(401);
        $this->signIn('user1');
        $this->get('sending-mail/manage')->assertStatus(403);
        $this->get('sending-mail/manage/any')->assertStatus(403);
        $this->signIn('admin1');
        $this->get('sending-mail/manage')->assertStatus(200);
    }

    public function testTheDateToOfTheMailListIncludesTheWholeDay(): void
    {
        $this->mail('m1', 'completed', '2027-03-10 00:00:01');
        $this->mail('m2', 'completed', '2027-03-10 23:59:58');
        $this->mail('m3', 'error', '2027-03-11 00:00:00');
        $this->mail('m4', 'completed', '2027-03-09 12:00:00');
        $this->signIn('admin1');

        $ids = fn (string $query) => array_column(json_decode($this->get('sending-mail/manage?sort=created&order=asc&' . $query)->getJSON(), true)['items'], 'id');

        $this->assertSame(['m1', 'm2'], $ids('date_from=2027-03-10&date_to=2027-03-10'));
        $this->assertSame(['m4', 'm1', 'm2'], $ids('date_to=2027-03-10'));
        $this->assertSame(['m1', 'm2', 'm3'], $ids('date_from=2027-03-10'));
        $this->assertSame(['m1', 'm2'], $ids('date_from=2027-03-10+00:00:00&date_to=2027-03-10+23:59:59'));

        // A filter that is not valid is ignored, a valid status narrows
        $this->assertSame(['m4', 'm1', 'm2', 'm3'], $ids('status=nonsense&date_from=yesterday&date_to=2027-02-30'));
        $this->assertSame(['m3'], $ids('status=error'));
    }

    public function testThePendingFilterIsTheQueueOfTheStats(): void
    {
        $this->mail('m1', 'created', '2027-03-10 10:00:00');
        $this->mail('m2', 'process', '2027-03-10 11:00:00');
        $this->mail('m3', 'completed', '2027-03-10 12:00:00');
        $this->signIn('admin1');

        $answer = json_decode($this->get('sending-mail/manage?sort=created&order=asc&status=pending')->getJSON(), true);

        // The "in the queue" chip lists exactly what its counter counts
        $this->assertSame(['m1', 'm2'], array_column($answer['items'], 'id'));
        $this->assertSame(2, $answer['stats']['pending']);
    }

    public function testTheMailDetailKeepsItsShape(): void
    {
        $this->mail('m1', 'completed', '2027-03-10 10:00:00');
        $this->signIn('admin1');

        $data = json_decode($this->get('sending-mail/manage/m1')->getJSON(), true)['data'];

        foreach (['id', 'status', 'email', 'subject', 'message', 'error', 'type', 'attempts', 'groupId', 'created', 'updated', 'sent', 'user', 'activity'] as $key) {
            $this->assertArrayHasKey($key, $data);
        }

        $this->get('sending-mail/manage/none')->assertStatus(404);
    }

    // ------------------------------------------------------------------ helpers

    /** @return array{status: int, body: array<string, mixed>} */
    private function createSeasonRequest(array $change): array
    {
        $body     = $change + ['id' => 'fresh', 'title_ru' => 'Новый', 'starts_on' => '2031-01-01', 'ends_on' => '2031-02-01'];
        $response = $this->withBodyFormat('json')->post('game/seasons', $body);

        return ['status' => $response->response()->getStatusCode(), 'body' => json_decode($response->getJSON(), true) ?? []];
    }

    /** @return array<string, mixed> */
    private function achievementBody(): array
    {
        return [
            'group_slug' => 'my_award', 'type' => 'base', 'tier' => 'gold', 'category' => 'game',
            'title_ru' => 'Награда', 'title_en' => 'Award', 'xp_bonus' => 10, 'sort_order' => 5, 'is_active' => true,
            'rules' => [['metric' => 'places_confirmed', 'value' => 3]],
        ];
    }

    private function season(string $id, string $from, string $to, array $fields = []): array
    {
        $this->db->table('game_seasons')->insert($fields + [
            'id' => $id, 'title_ru' => 'Сезон ' . $id, 'title_en' => 'Season ' . $id,
            'starts_on' => $from, 'ends_on' => $to, 'created_at' => date('Y-m-d H:i:s'),
        ]);

        return (new GameLibrary())->find($id);
    }

    private function points(string $season, string $userId, string $placeId, string $createdAt, int $points = 10): void
    {
        $this->db->table('game_points')->insert([
            'id' => substr(md5($season . $userId . $placeId), 0, 13), 'season' => $season, 'user_id' => $userId, 'kind' => 'place',
            'place_id' => $placeId, 'visit_id' => null, 'points' => $points, 'created_at' => $createdAt,
        ]);
    }

    public function testManageCarriesHoldersAndCreatedAt(): void
    {
        $this->award('ach1');
        $this->award('ach2');
        $this->earned('ach1', 'user1', '2027-01-01 10:00:00');
        $this->earned('ach1', 'user2', '2027-01-02 10:00:00');
        $this->signIn('admin1');

        $items = array_column(json_decode($this->get('achievements/manage')->getJSON(), true)['data'], null, 'id');

        $this->assertSame(2, $items['ach1']['holders']);
        $this->assertSame(0, $items['ach2']['holders']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/', $items['ach1']['created_at']);
    }

    public function testRecentIsLatestFirstLimitedLocalisedAndSkipsDeletedUsers(): void
    {
        $this->award('ach1');
        $this->award('ach2');
        $this->earned('ach1', 'user1', '2027-01-01 10:00:00');
        $this->earned('ach2', 'user1', '2027-01-03 10:00:00');
        $this->earned('ach1', 'user2', '2027-01-02 10:00:00');
        $this->signIn('admin1');

        $answer = json_decode($this->get('achievements/manage/recent')->getJSON(), true);
        $this->assertSame(['2027-01-03 10:00:00', '2027-01-02 10:00:00', '2027-01-01 10:00:00'], array_column($answer['items'], 'earned_at'));
        $first = $answer['items'][0];
        $this->assertSame('ach2', $first['achievement']['id']);
        $this->assertSame(['id', 'title', 'image', 'tier', 'category', 'group_slug'], array_keys($first['achievement']));
        $this->assertSame('user1', $first['user']['id']);
        $this->assertArrayHasKey('level', $first['user']['levelData']);
        $this->assertArrayHasKey('avatar', $first['user']);

        $this->assertCount(2, json_decode($this->get('achievements/manage/recent?limit=2')->getJSON(), true)['items']);
        $this->assertCount(3, json_decode($this->get('achievements/manage/recent?limit=500')->getJSON(), true)['items']);

        $this->db->table('users')->where('id', 'user2')->update(['deleted_at' => date('Y-m-d H:i:s')]);
        $this->assertCount(2, json_decode($this->get('achievements/manage/recent')->getJSON(), true)['items']);

        $this->assertSame('Награда', json_decode($this->get('achievements/manage/recent')->getJSON(), true)['items'][0]['achievement']['title']);
        $en = json_decode($this->withHeaders(['Locale' => 'en'])->get('achievements/manage/recent')->getJSON(), true);
        $this->assertSame('Award', $en['items'][0]['achievement']['title']);
    }

    private function earned(string $achievement, string $user, string $at): void
    {
        $this->db->table('users_achievements')->insert([
            'id' => $achievement . $user, 'user_id' => $user, 'achievement_id' => $achievement, 'earned_at' => $at,
        ]);
    }

    private function award(string $id): void
    {
        $this->db->table('achievements')->insert([
            'id' => $id, 'group_slug' => $id, 'type' => 'base', 'tier' => 'none', 'category' => 'game',
            'title_en' => 'Award', 'title_ru' => 'Награда', 'rules' => '[]', 'xp_bonus' => 0, 'sort_order' => 1, 'is_active' => 1,
            'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private function mail(string $id, string $status, string $createdAt): void
    {
        $this->db->table('sending_mail')->insert([
            'id' => $id, 'user_id' => 'user1', 'type' => 'digest', 'status' => $status, 'email' => 'user1@example.com',
            'locale' => 'ru', 'subject' => 'Subject ' . $id, 'message' => '<p>Body</p>', 'created_at' => $createdAt, 'updated_at' => $createdAt,
        ]);
    }

    /** A JSON request with the body as it is sent (the nested values are not passed through $_POST) */
    private function json(string $method, string $uri, array $body): \CodeIgniter\Test\TestResponse
    {
        return $this->withBodyFormat('json')->withBody(json_encode($body))->{$method}($uri);
    }

    private function tempFile(string $content, string $extension): string
    {
        $path = tempnam(sys_get_temp_dir(), 'adm') ?: '';
        rename($path, $path .= '.' . $extension);
        file_put_contents($path, $content);

        return $path;
    }

    /**
     * A multipart upload of `image`, as PHP presents it in $_FILES.
     *
     * @param array<string, string> $fields
     */
    private function upload(string $uri, string $file, string $mime, array $fields = []): \CodeIgniter\Test\TestResponse
    {
        service('superglobals')->setFilesArray(['image' => [
            'name' => basename($file), 'type' => $mime, 'tmp_name' => $file, 'error' => UPLOAD_ERR_OK, 'size' => filesize($file),
        ]]);

        return $this->post($uri, $fields);
    }
}
