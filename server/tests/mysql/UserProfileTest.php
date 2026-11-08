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
}
