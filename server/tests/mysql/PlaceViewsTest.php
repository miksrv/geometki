<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * A place view is counted by POST /places/:id/views (the page comes from caches that never
 * reach GET /places/:id), which answers the new count and the visitor's own score.
 *
 * @internal
 */
final class PlaceViewsTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('user1');
        $this->db->table('places')->insert(['id' => 'place1', 'lat' => 53.1, 'lon' => 57.2, 'views' => 10, 'updated_at' => '2026-01-01 10:00:00']);
        $this->db->table('places_content')->insert(['id' => 'text1', 'place_id' => 'place1', 'locale' => 'ru', 'title' => 'Водопад', 'content' => '']);
        $this->db->table('rating')->insert(['id' => 'rating1', 'place_id' => 'place1', 'user_id' => 'user1', 'value' => 4]);
    }

    private function place(): object
    {
        return $this->db->table('places')->select('views, updated_at')->where('id', 'place1')->get()->getRow();
    }

    public function testShowingAPlaceCountsNoView(): void
    {
        $this->get('places/place1')->assertOK();

        $this->assertSame(10, (int) $this->place()->views);
    }

    public function testAViewIsCountedWithoutTouchingTheEditTime(): void
    {
        $response = $this->post('places/place1/views');
        $response->assertOK();
        $body = json_decode($response->getJSON(), true);

        $this->assertSame(['views' => 11, 'vote' => null], $body);
        $this->assertSame(11, (int) $this->place()->views);
        $this->assertSame('2026-01-01 10:00:00', $this->place()->updated_at);
        $this->assertSame(1, (int) $this->db->table('places_views_log')->where('place_id', 'place1')->get()->getRow()->count);
    }

    public function testTheSignedInVisitorGetsTheirScore(): void
    {
        $this->signIn('user1');

        $this->assertSame(4, json_decode($this->post('places/place1/views')->getJSON(), true)['vote']);
    }

    public function testAnUnknownPlaceIsNotFound(): void
    {
        $this->post('places/unknown1/views')->assertStatus(404);
    }
}
