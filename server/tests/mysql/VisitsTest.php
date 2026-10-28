<?php

use App\Libraries\VisitsLibrary;
use App\Models\UserInterestProfilesModel;
use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * Visits are a log (features/25-visits-and-exploration.md, step 1): a check-in is one tap,
 * repeatable, one per day, asks no location; the photos of the day are the visit's; a visit
 * can be deleted; the one-tap questions of the category are answered after it (step 2).
 *
 * @internal
 */
final class VisitsTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('user1');
        $this->createUser('user2');

        $this->db->table('places')->insert([
            'id' => 'place1', 'user_id' => 'user2', 'category' => 'waterfall', 'lat' => 53.1, 'lon' => 57.2, 'slug' => 'atysh',
        ]);
        $this->db->table('places_content')->insert([
            'id' => 'text1', 'place_id' => 'place1', 'user_id' => 'user2', 'locale' => 'ru', 'title' => 'Атыш', 'content' => 'Водопад.',
        ]);
        // Another place with a visit of another person: the lists must not leak it
        $this->db->table('places')->insert([
            'id' => 'place2', 'user_id' => 'user2', 'category' => 'cave', 'lat' => 53.2, 'lon' => 57.3, 'slug' => 'cave',
        ]);
        $this->db->table('users_visited_places')->insert([
            'id' => 'visit0', 'user_id' => 'user2', 'place_id' => 'place2', 'visited_at' => '2026-01-10 12:00:00', 'created_at' => '2026-01-10 12:00:00',
        ]);
    }

    public function testAGuestCannotCheckIn(): void
    {
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->assertStatus(401);
    }

    public function testACheckInIsRepeatableButOncePerDay(): void
    {
        $this->signIn('user1');

        $first = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->getJSON(), true);

        $this->assertTrue($first['isNew']);
        $this->assertSame(1, $first['ordinal']);
        $this->assertTrue($first['firstThisYear']);
        $this->assertSame(date('Y-m-d'), $first['visitedAt']);
        $this->assertArrayNotHasKey('note', $first);

        $again = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->getJSON(), true);

        $this->assertFalse($again['isNew']);
        $this->assertSame($first['id'], $again['id']);

        // Yesterday (the visitor's day may be behind the server's): a visit of its own, the
        // first of the place by the day, so today's is the second
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        $past      = json_decode(
            $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => $yesterday])->getJSON(),
            true
        );

        $this->assertTrue($past['isNew']);
        $this->assertSame($yesterday, $past['visitedAt']);
        $this->assertTrue($past['firstThisYear']);
        $this->assertSame(1, $past['ordinal']);

        // Two taps at once: the unique key lets one visit of a day through
        $this->expectException(\CodeIgniter\Database\Exceptions\DatabaseException::class);
        $this->db->table('users_visited_places')->insert([
            'id' => 'twin', 'user_id' => 'user1', 'place_id' => 'place1', 'visited_at' => $yesterday . ' 12:00:00', 'created_at' => $yesterday . ' 12:00:00',
        ]);
    }

    public function testTheListsCountTheVisitsAndThePeople(): void
    {
        $this->signIn('user1');

        $this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->assertStatus(201);
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => date('Y-m-d', strtotime('-1 day'))])->assertStatus(201);

        $this->assertSame(2, $this->db->table('users_visited_places')->where('user_id', 'user1')->countAllResults());
        $this->assertSame(2, $this->db->table('activity')->where(['type' => 'visit', 'user_id' => 'user1'])->countAllResults());

        // The place's author hears of it
        $this->assertSame(2, $this->db->table('users_notifications')->where('user_id', 'user2')->countAllResults());

        $this->withBodyFormat('json')->post('visits', ['place' => 'place2'])->assertStatus(201);

        $list = json_decode($this->get('visits', ['place' => 'place1'])->getJSON(), true);

        $this->assertSame(2, $list['count']);
        $this->assertSame(1, $list['people']);
        $this->assertSame(date('Y-m-d'), $list['last']);
        $this->assertSame('user1', $list['items'][0]['author']['id']);
        $this->assertSame('User user1', $list['items'][0]['author']['name']);
        $this->assertCount(2, $list['items']);
        $this->assertSame(['user1'], array_column($list['visitors'], 'id'));

        // The faces of a place: distinct people, the latest first
        $list2 = json_decode($this->get('visits', ['place' => 'place2'])->getJSON(), true);

        $this->assertSame(2, $list2['people']);
        $this->assertSame(['user1', 'user2'], array_column($list2['visitors'], 'id'));
        $this->assertSame('User user2', $list2['visitors'][1]['name']);

        $places = json_decode($this->get('visits/places', ['user' => 'user1'])->getJSON(), true);

        $this->assertSame(2, $places['count']);
        $this->assertEqualsCanonicalizing(['place1', 'place2'], array_column($places['items'], 'id'));

        $profile = json_decode($this->get('users/user1')->getJSON(), true);

        $this->assertSame(2, $profile['statistic']['visited']);
        $this->assertSame(3, $profile['statistic']['visits']);
    }

    public function testTheDayMustBeARealDayNotInTheFuture(): void
    {
        $this->signIn('user1');

        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => '2024-02-30'])->assertStatus(400);
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => date('Y-m-d', strtotime('+10 days'))])->assertStatus(400);
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => 'yesterday'])->assertStatus(400);
        // Not back-dated either: a visit with a contribution is worth experience once per place and month
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => date('Y-m-d', strtotime('-10 days'))])->assertStatus(400);
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => '2024-07-01'])->assertStatus(400);
        // A day of slack either way for the visitor's time zone
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => date('Y-m-d', strtotime('-2 days'))])->assertStatus(201);
        $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => date('Y-m-d', strtotime('+1 day'))])->assertStatus(201);
    }

    public function testThePhotosUploadedBeforeTheTapThatDayAreTheVisits(): void
    {
        $this->signIn('user1');

        // Uploaded today and yesterday without a visit; an old one and another person's are not of the trip
        $this->db->table('photos')->insertBatch([
            $this->photoRow('photo1', 'user1', date('Y-m-d H:i:s')),
            $this->photoRow('photo2', 'user1', date('Y-m-d H:i:s', strtotime('-1 day'))),
            $this->photoRow('photo3', 'user1', date('Y-m-d H:i:s', strtotime('-10 days'))),
            $this->photoRow('photo4', 'user2', date('Y-m-d H:i:s')),
        ]);

        $visit = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->getJSON(), true);

        $this->assertEqualsCanonicalizing(['photo1', 'photo2'], array_column($visit['photos'], 'id'));
        $this->assertSame(
            ['photo1' => $visit['id'], 'photo2' => $visit['id'], 'photo3' => null, 'photo4' => null],
            array_column($this->db->table('photos')->select('id, visit_id')->orderBy('id')->get()->getResultArray(), 'visit_id', 'id')
        );
        // The visit is a contribution at once
        $this->assertSame(MODIFIER_VISIT, $this->experience('user1'));
    }

    public function testAPhotoOfTheDayBelongsToTheVisitAndIsWorthExperienceOncePerPlaceAndMonth(): void
    {
        $this->signIn('user1');

        $visit = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->getJSON(), true);

        $this->assertSame(0, $this->experience('user1'));

        // A bare visit is none; a visit of another day is not the photo's
        $library = new VisitsLibrary();
        $this->assertSame($visit['id'], $library->photoVisit('user1', 'place1')?->id);
        $this->assertNull($library->photoVisit('user1', 'place2'));
        $this->assertNull($library->photoVisit('user2', 'place2'));
        $this->assertNull($library->photoVisit(null, 'place1'));

        $this->insertPhoto('photo1', $visit['id']);
        $library->afterChange('user1', 'place1');

        $this->assertSame(MODIFIER_VISIT, $this->experience('user1'));

        $me = json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame(['photo1'], array_column($me['items'][0]['photos'], 'id'));

        // A second visit with a photo the same month: nothing more
        $second = json_decode(
            $this->withBodyFormat('json')->post('visits', ['place' => 'place1', 'visitedAt' => date('Y-m-d', strtotime('-1 day'))])->getJSON(),
            true
        );
        $this->insertPhoto('photo2', $second['id']);
        $library->afterChange('user1', 'place1');

        $sameMonth = date('Y-m', strtotime('-1 day')) === date('Y-m');
        $this->assertSame($sameMonth ? MODIFIER_VISIT : 2 * MODIFIER_VISIT, $this->experience('user1'));

        // Another month, another place: one more
        $this->db->table('users_visited_places')->insert([
            'id' => 'visit9', 'user_id' => 'user1', 'place_id' => 'place2', 'visited_at' => '2025-03-10 12:00:00', 'created_at' => '2025-03-10 12:00:00',
        ]);
        $this->insertPhoto('photo3', 'visit9', 'place2');
        $library->afterChange('user1', 'place2');

        $this->assertSame(($sameMonth ? 2 : 3) * MODIFIER_VISIT, $this->experience('user1'));
    }

    public function testDeletingAVisitTakesItsEventAndExperienceAlong(): void
    {
        $this->signIn('user1');

        $visit = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->getJSON(), true);

        $this->insertPhoto('photo1', $visit['id']);
        (new VisitsLibrary())->afterChange('user1', 'place1');
        $this->assertSame(MODIFIER_VISIT, $this->experience('user1'));

        $this->signIn('user2');
        $this->delete('visits/' . $visit['id'])->assertStatus(403);

        $this->signIn('user1');
        $this->delete('visits/' . $visit['id'])->assertOK();

        $this->assertSame(0, $this->db->table('users_visited_places')->where('user_id', 'user1')->countAllResults());
        $this->assertSame(0, $this->db->table('activity')->where('deleted_at IS NULL')->where('type', 'visit')->countAllResults());
        $this->assertSame(0, $this->experience('user1'));
        // The photo stays with the place
        $this->assertNull($this->db->table('photos')->select('visit_id')->where('id', 'photo1')->get()->getRow()->visit_id);

        $this->delete('visits/' . $visit['id'])->assertStatus(404);
        $this->get('visits/me', ['place' => 'place1'])->assertJSONFragment(['count' => 0]);
    }

    public function testAnOldVisitIsAskedTheQuestionsItHasNoAnswerTo(): void
    {
        // Checked in before the questions came
        $this->db->table('users_visited_places')->insert([
            'id' => 'old1', 'user_id' => 'user1', 'place_id' => 'place1', 'visited_at' => '2023-05-14 12:00:00', 'created_at' => '2023-05-14 12:00:00',
        ]);
        $this->db->table('visit_answers')->insert(['visit_id' => 'old1', 'question' => 'road', 'value' => 'dirt', 'created_at' => '2023-05-14 12:00:00']);
        $this->signIn('user1');

        // The questions of its share it has not answered, then the features
        $me = json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame(['walk', 'water', 'can'], array_column($me['questions'], 'key'));

        $this->withBodyFormat('json')->patch('visits/old1', ['answers' => ['walk' => 'short']])->assertOK();
        $me = json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame(['road' => 'dirt', 'walk' => 'short'], $me['items'][0]['answers']);
    }

    public function testTheQuestionsOfTheCategoryAreAnsweredInOneTapAndMakeHowItIsNow(): void
    {
        $this->signIn('user1');

        // Three of the pool of the category, the practical ones first while nothing is known, then the features
        $me = json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame(['road', 'walk', 'water', 'can'], array_column($me['questions'], 'key'));
        $this->assertSame(['asphalt', 'dirt', 'offroad', 'foot', 'water'], $me['questions'][0]['values']);
        $this->assertSame(['swim', 'camp', 'kids', 'winter', 'drink'], $me['questions'][3]['features']);

        $visit = json_decode($this->withBodyFormat('json')->post('visits', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame([], (array) $visit['answers']);

        // Not of this category, not a value of the question, not an object: refused
        $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => ['safety' => 'safe']])->assertStatus(400);
        $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => ['road' => 'bus']])->assertStatus(400);
        // A feature the category does not ask, a value that is not yes/no
        $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => ['can_fish' => 'yes']])->assertStatus(400);
        $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => ['can_swim' => 'maybe']])->assertStatus(400);
        $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => []])->assertStatus(400);
        $this->assertSame(0, $this->db->table('visit_answers')->countAllResults());

        $updated = json_decode(
            $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => ['road' => 'dirt', 'water' => 'present']])->getJSON(),
            true
        );
        $this->assertSame(['road' => 'dirt', 'water' => 'present'], $updated['answers']);
        // An answer is a contribution
        $this->assertSame(MODIFIER_VISIT, $this->experience('user1'));
        // Two answered: one more question of the visit's share, the next unknown one
        $me = json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame(['walk', 'can'], array_column($me['questions'], 'key'));

        // Changed, and removed with null; the features are yes/no questions of their own
        $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => ['road' => 'offroad', 'water' => null, 'can_swim' => 'yes', 'can_camp' => 'no']])->assertOK();
        $me = json_decode($this->get('visits/me', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame(['can_camp' => 'no', 'can_swim' => 'yes', 'road' => 'offroad'], $me['items'][0]['answers']);

        // Another person cannot answer for it; a guest neither
        $this->signIn('user2');
        $this->withBodyFormat('json')->patch('visits/' . $visit['id'], ['answers' => ['road' => 'dirt']])->assertStatus(403);

        // Older visits of other people: the agreement window and the history
        foreach ([
            ['visit5', 'user2', '2025-03-01', 'dirt'],
            ['visit2', 'user2', '2024-08-01', 'dirt'],
            ['visit3', 'user1', '2023-06-01', 'asphalt'],
            ['visit4', 'user2', '2019-05-01', 'foot'],
        ] as [$id, $userId, $day, $road]) {
            $this->db->table('users_visited_places')->insert([
                'id' => $id, 'user_id' => $userId, 'place_id' => 'place1', 'visited_at' => $day . ' 12:00:00', 'created_at' => $day . ' 12:00:00',
            ]);
            $this->db->table('visit_answers')->insert(['visit_id' => $id, 'question' => 'road', 'value' => $road, 'created_at' => $day . ' 12:00:00']);
        }

        // Rows inserted behind the API: the summary is recounted
        (new VisitsLibrary())->rebuildNow('place1');

        $list = json_decode($this->get('visits', ['place' => 'place1'])->getJSON(), true);
        $this->assertSame(['road', 'can_swim', 'can_camp'], array_column($list['now'], 'question'));

        // The next visitor is asked what is still unknown; the road, known but contested, waits its turn
        $this->assertSame(['walk', 'water', 'trail', 'can'], array_column((new VisitsLibrary())->questionsFor('waterfall', 'place1', null), 'key'));
        $this->assertSame(['yes', 'no'], [$list['now'][1]['value'], $list['now'][2]['value']]);

        $now = $list['now'][0];
        $this->assertSame('road', $now['question']);
        $this->assertSame('offroad', $now['value']);
        $this->assertSame(date('Y-m-d'), $now['visitedAt']);
        // The agreement is counted over the three years up to the latest answer (today's), one
        // person once, by their latest answer: user1 today, user2 in 2025 (their 2024 one does not count)
        $this->assertSame(2, $now['total']);
        $this->assertSame(1, $now['agree']);
        $this->assertSame([
            ['year' => 2025, 'value' => 'dirt'],
            ['year' => 2024, 'value' => 'dirt'],
            ['year' => 2023, 'value' => 'asphalt'],
        ], $now['history']);

        // The features feed the interests: user2 bookmarked the place where one can swim
        $this->db->table('users_bookmarks')->insert(['user_id' => 'user2', 'place_id' => 'place1']);
        (new UserInterestProfilesModel())->refreshForUser('user2');
        $interests = (new UserInterestProfilesModel())->getInterestsByType('user2', 'feature');
        $this->assertSame(['swim'], array_column($interests, 'interest_value'));
        // Stored as the kind itself, not as the empty value of an ENUM that lacks it
        $this->assertSame(
            ['feature'],
            array_column($this->db->table('users_interest_profiles')->select('interest_type')->where('interest_value', 'swim')->get()->getResultArray(), 'interest_type')
        );
        $this->assertSame(['waterfall', 'cave'], array_column((new UserInterestProfilesModel())->getInterestsByType('user2', 'category'), 'interest_value'));

        // A deleted visit takes its answers along, "how it is now" follows
        $this->signIn('user1');
        $this->delete('visits/' . $visit['id'])->assertOK();
        $this->assertSame(4, $this->db->table('visit_answers')->countAllResults());
        $this->assertSame(['road'], array_column(json_decode($this->get('visits', ['place' => 'place1'])->getJSON(), true)['now'], 'question'));
        $this->assertSame('dirt', (new VisitsLibrary())->now('place1')[0]['value']);
        // Only the 2023 visit with its answer is left to count
        $this->assertSame(MODIFIER_VISIT, $this->experience('user1'));
    }

    public function testAVisitAsksWhatThePlaceDoesNotKnowYet(): void
    {
        $library = new VisitsLibrary();

        // Nothing known: the pool's first three; an unknown category asks nothing
        $this->assertSame(['road', 'walk', 'trail', 'can'], array_column($library->questionsFor('mountain', 'place1', null), 'key'));
        $this->assertSame([], $library->questionsFor('unknown', 'place1', null));
        // A museum has no road question
        $this->assertSame(['entry', 'parking', 'access', 'can'], array_column($library->questionsFor('museum', 'place1', null), 'key'));

        // All of the pool known: the stale and the contested first, the oldest of them first, then the rest by age
        $fresh = date('Y-m-d', strtotime('-2 months'));
        $rows  = [
            ['road', 1, 1, date('Y-m-d', strtotime('-3 years'))],   // stale
            ['walk', 1, 1, $fresh],
            ['trail', 2, 4, $fresh],                                 // contested: half agree
            ['time', 3, 3, date('Y-m-d', strtotime('-2 years'))],   // stale, newer than the road
            ['crowd', 1, 1, date('Y-m-d', strtotime('-1 month'))],
            ['entry', 1, 1, date('Y-m-d', strtotime('-6 months'))],
            ['cell', 1, 1, $fresh],
            ['facilities', 3, 4, $fresh],
        ];

        foreach ($rows as [$question, $agree, $total, $day]) {
            $this->db->table('places_now')->insert([
                'place_id' => 'place1', 'question' => $question, 'value' => 'x', 'agree' => $agree, 'total' => $total, 'visited_at' => $day,
            ]);
        }

        $this->assertSame(['road', 'time', 'trail', 'can'], array_column($library->questionsFor('mountain', 'place1', null), 'key'));

        // The visit answered two of its share: one is left, the stale ones are gone, so the oldest fresh one
        $this->db->table('users_visited_places')->insert([
            'id' => 'visit5', 'user_id' => 'user1', 'place_id' => 'place1', 'visited_at' => date('Y-m-d') . ' 12:00:00', 'created_at' => date('Y-m-d H:i:s'),
        ]);
        $this->db->table('visit_answers')->insertBatch([
            ['visit_id' => 'visit5', 'question' => 'time', 'value' => 'hour', 'created_at' => date('Y-m-d H:i:s')],
            ['visit_id' => 'visit5', 'question' => 'road', 'value' => 'dirt', 'created_at' => date('Y-m-d H:i:s')],
            // The features do not count against the share
            ['visit_id' => 'visit5', 'question' => 'can_camp', 'value' => 'yes', 'created_at' => date('Y-m-d H:i:s')],
        ]);

        $this->assertSame(['trail', 'can'], array_column($library->questionsFor('mountain', 'place1', 'visit5'), 'key'));

        $this->db->table('visit_answers')->insert(['visit_id' => 'visit5', 'question' => 'trail', 'value' => 'marked', 'created_at' => date('Y-m-d H:i:s')]);
        $this->assertSame(['can'], array_column($library->questionsFor('mountain', 'place1', 'visit5'), 'key'));
    }

    private function experience(string $userId): int
    {
        return (int) $this->db->table('users')->select('experience')->where('id', $userId)->get()->getRow()->experience;
    }

    private function insertPhoto(string $id, string $visitId, string $placeId = 'place1'): void
    {
        $this->db->table('photos')->insert([
            'id' => $id, 'place_id' => $placeId, 'visit_id' => $visitId, 'user_id' => 'user1', 'lat' => 53.1, 'lon' => 57.2,
            'filename' => $id, 'extension' => 'jpg', 'filesize' => 1000, 'width' => 1200, 'height' => 800,
        ]);
    }

    /** @return array<string, mixed> */
    private function photoRow(string $id, string $userId, string $createdAt): array
    {
        return [
            'id' => $id, 'place_id' => 'place1', 'visit_id' => null, 'user_id' => $userId, 'lat' => 53.1, 'lon' => 57.2,
            'filename' => $id, 'extension' => 'jpg', 'filesize' => 1000, 'width' => 1200, 'height' => 800, 'created_at' => $createdAt,
        ];
    }
}
