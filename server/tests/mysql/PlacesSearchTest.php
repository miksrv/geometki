<?php

use App\Libraries\PlacesContent;
use Tests\Support\MySqlTestCase;

/**
 * PlacesContent::search(): a 1–3 character term goes through LIKE, which matches
 * nearly every place, so it is capped.
 *
 * @internal
 */
final class PlacesSearchTest extends MySqlTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $places  = [];
        $content = [];

        for ($i = 1; $i <= PlacesContent::SHORT_TERM_LIMIT + 20; $i++) {
            $places[]  = ['id' => 'place' . $i, 'lat' => 51.5, 'lon' => 55.1];
            $content[] = ['id' => 'text' . $i, 'place_id' => 'place' . $i, 'locale' => 'ru', 'title' => 'Водопад номер ' . $i, 'content' => ''];
        }

        $this->db->table('places')->insertBatch($places);
        $this->db->table('places_content')->insertBatch($content);
    }

    public function testAShortTermFindsAtMostTheCap(): void
    {
        $search = new PlacesContent();
        $search->search('Во');

        $this->assertCount(PlacesContent::SHORT_TERM_LIMIT, $search->placeIds);
    }

    public function testAShortTermKeepsASmallerLimit(): void
    {
        $search = new PlacesContent();
        $search->search('Во', 5, [], false);

        $this->assertCount(5, $search->placeIds);
    }

    public function testAShortTermStillFindsOnlyMatches(): void
    {
        $search = new PlacesContent();
        $search->search('Гор');

        $this->assertSame([], $search->placeIds);
    }
}
