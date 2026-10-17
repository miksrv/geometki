<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * GET /stats `categories`: places per whitelisted category, the fullest first;
 * deleted places and keys outside the whitelist are not counted.
 *
 * @internal
 */
final class StatsTest extends MySqlTestCase
{
    use FeatureTestTrait;

    public function testCategoriesCountTheLivePlacesOfKnownCategories(): void
    {
        $places = [
            ['id' => 'place1', 'category' => 'waterfall'],
            ['id' => 'place2', 'category' => 'waterfall'],
            ['id' => 'place3', 'category' => 'cave'],
            ['id' => 'place4', 'category' => 'cave', 'deleted_at' => date('Y-m-d H:i:s')],
            ['id' => 'place5', 'category' => 'not-a-category'],
            ['id' => 'place6', 'category' => null],
        ];

        foreach ($places as $place) {
            $this->db->table('places')->insert($place + ['lat' => 53.1, 'lon' => 57.2]);
        }

        $body = json_decode($this->get('stats')->getJSON(), true);

        $this->assertSame([
            ['name' => 'waterfall', 'count' => 2],
            ['name' => 'cave', 'count' => 1],
        ], $body['categories']);
    }
}
