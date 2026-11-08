<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * GET /users/:id: the public profile carries no private fields; the owner's own one does.
 *
 * @internal
 */
final class UserProfileTest extends MySqlTestCase
{
    use FeatureTestTrait;

    public function testAPublicProfileHasNoEmailNorSettings(): void
    {
        $this->createUser('user1', ['auth_type' => 'native', 'locale' => 'ru']);
        $this->createUser('user2');

        $guest = json_decode($this->get('users/user1')->getJSON(), true);

        $this->assertSame('user1', $guest['id']);
        $this->assertArrayNotHasKey('email', $guest);
        $this->assertArrayNotHasKey('authType', $guest);
        $this->assertArrayNotHasKey('locale', $guest);
        $this->assertArrayNotHasKey('settings', $guest);

        $this->signIn('user2');

        $other = json_decode($this->get('users/user1')->getJSON(), true);

        $this->assertArrayNotHasKey('email', $other);
        $this->assertArrayNotHasKey('settings', $other);
    }

    public function testTheOwnerGetsTheirPrivateFields(): void
    {
        $this->createUser('user1', ['auth_type' => 'native', 'locale' => 'ru']);
        $this->signIn('user1');

        $own = json_decode($this->get('users/user1')->getJSON(), true);

        $this->assertSame('user1@example.com', $own['email']);
        $this->assertSame('native', $own['authType']);
        $this->assertSame('ru', $own['locale']);
        $this->assertIsArray($own['settings']);
    }

    public function testTheStatisticCountsTheBookmarksOfExistingPlaces(): void
    {
        $this->createUser('user1');
        $this->createUser('user2');
        foreach (['p1' => null, 'p2' => null, 'gone' => '2026-02-04 10:00:00'] as $placeId => $deleted) {
            $this->db->table('places')->insert([
                'id'         => $placeId,
                'slug'       => 'slug-' . $placeId,
                'category'   => 'waterfall',
                'lat'        => 53.1,
                'lon'        => 57.2,
                'user_id'    => 'user2',
                'created_at' => '2026-02-01 10:00:00',
                'updated_at' => '2026-02-01 10:00:00',
                'deleted_at' => $deleted,
            ]);
        }

        foreach (['p1', 'p2', 'gone'] as $placeId) {
            $this->db->table('users_bookmarks')->insert(['id' => 'b-' . $placeId, 'user_id' => 'user1', 'place_id' => $placeId]);
        }

        $profile = json_decode($this->get('users/user1')->getJSON(), true);

        $this->assertSame(2, $profile['statistic']['bookmarks']);
    }
}
