<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * GET /users `places`: the newest places with a cover of each user, at most four, for the
 * strip of covers on the people list cards.
 *
 * @internal
 */
final class UsersListTest extends MySqlTestCase
{
    use FeatureTestTrait;

    /** The setting before the test; null when the test was skipped before saving it */
    private ?bool $verifyFiles = null;

    protected function setUp(): void
    {
        parent::setUp();

        // No cover files in tests: a place with photos is taken as having one
        $this->verifyFiles = config('Uploads')->verifyFiles;
        config('Uploads')->verifyFiles = false;
    }

    protected function tearDown(): void
    {
        if ($this->verifyFiles !== null) {
            config('Uploads')->verifyFiles = $this->verifyFiles;
        }

        parent::tearDown();
    }

    public function testCardsCarryTheNewestPlacesWithCovers(): void
    {
        $this->createUser('user1');
        $this->createUser('user2');

        $this->createPlace('old', 'user1', '2026-01-01 10:00:00');
        foreach (['p2', 'p3', 'p4', 'p5'] as $i => $id) {
            $this->createPlace($id, 'user1', '2026-02-0' . ($i + 1) . ' 10:00:00');
        }
        $this->createPlace('nophoto', 'user1', '2026-03-01 10:00:00', ['photos' => 0]);
        $this->createPlace('deleted', 'user1', '2026-03-02 10:00:00', ['deleted_at' => '2026-03-03 10:00:00']);

        $body  = json_decode($this->get('users?places=1')->getJSON(), true);
        $users = array_column($body['items'], null, 'id');

        $this->assertSame(['p5', 'p4', 'p3', 'p2'], array_column($users['user1']['places'], 'id'));
        $this->assertSame('Title p5', $users['user1']['places'][0]['title']);
        $this->assertSame('waterfall', $users['user1']['places'][0]['category']);
        $this->assertStringStartsWith('uploads/places/p5/cover_preview.jpg?d=', $users['user1']['places'][0]['cover']['preview']);
        $this->assertSame([], $users['user2']['places']);
    }

    public function testEveryUserGetsTheirOwnPlaces(): void
    {
        $this->createUser('user1');
        $this->createUser('user2');
        $this->createPlace('a1', 'user1', '2026-02-01 10:00:00');
        $this->createPlace('b1', 'user2', '2026-02-02 10:00:00');
        $this->createPlace('b2', 'user2', '2026-02-03 10:00:00', ['photos' => 0, 'cover_external_id' => 'ext1']);

        $body  = json_decode($this->get('users?places=1')->getJSON(), true);
        $users = array_column($body['items'], null, 'id');

        $this->assertSame(['a1'], array_column($users['user1']['places'], 'id'));
        $this->assertSame(['b2', 'b1'], array_column($users['user2']['places'], 'id'));
        $this->assertSame(
            'uploads/places/a1/cover_preview.jpg?d=' . strtotime('2026-02-01 10:00:00'),
            $users['user1']['places'][0]['cover']['preview']
        );
    }

    public function testAPlaceWithoutACoverFileGivesWayToAnOlderOne(): void
    {
        config('Uploads')->verifyFiles = true;

        $this->createUser('user1');
        $this->createPlace('nofile', 'user1', '2026-02-02 10:00:00');
        $this->createPlace('withfile', 'user1', '2026-02-01 10:00:00');

        $dir = UPLOAD_PHOTOS . 'withfile/';
        @mkdir($dir, 0777, true);
        touch($dir . 'cover.jpg');

        try {
            $body = json_decode($this->get('users?places=1')->getJSON(), true);
        } finally {
            unlink($dir . 'cover.jpg');
            rmdir($dir);
        }

        $this->assertSame(['withfile'], array_column($body['items'][0]['places'], 'id'));
    }

    public function testThePlacesAreLeftOutUnlessAskedFor(): void
    {
        $this->createUser('user1');
        $this->createPlace('p1', 'user1', '2026-02-01 10:00:00');

        $body = json_decode($this->get('users')->getJSON(), true);

        $this->assertArrayNotHasKey('places', $body['items'][0]);
    }

    private function createPlace(string $id, string $userId, string $created, array $fields = []): void
    {
        $this->db->table('places')->insert($fields + [
            'id'         => $id,
            'slug'       => 'slug-' . $id,
            'category'   => 'waterfall',
            'lat'        => 53.1,
            'lon'        => 57.2,
            'photos'     => 1,
            'user_id'    => $userId,
            'created_at' => $created,
            'updated_at' => $created,
        ]);

        $this->db->table('places_content')->insert([
            'id'       => 'c-' . $id,
            'place_id' => $id,
            'locale'   => 'ru',
            'title'    => 'Title ' . $id,
            'content'  => 'Text',
        ]);
    }
}
