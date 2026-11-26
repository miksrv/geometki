<?php

use App\Libraries\GameLibrary;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Game;

/**
 * The numbers of the game (Config\Game) and the pure parts of GameLibrary: the points of a
 * place, the medals of a season, "near the place". No database.
 *
 * @internal
 */
final class GameRulesTest extends CIUnitTestCase
{
    public function testThePointsOfAPlaceAreBaseTimesCategoryTimesTheBonusToTheFirstOnes(): void
    {
        $config = new Game();

        // A hike, the first of the season: 10 × 2 × 2
        $this->assertSame(40, $config->placePoints('cave', 1));
        // The second to the fifth: × 1.5; then no bonus
        $this->assertSame(30, $config->placePoints('cave', 2));
        $this->assertSame(30, $config->placePoints('cave', 5));
        $this->assertSame(20, $config->placePoints('cave', 6));
        // Out of town: × 1.5, rounded
        $this->assertSame(23, $config->placePoints('manor', 3));
        // In town, and a category the table does not list
        $this->assertSame(10, $config->placePoints('memorial', 9));
        $this->assertSame(10, $config->placePoints('unknown', 9));
        $this->assertSame(20, $config->placePoints(null, 1));
    }

    public function testEveryCategoryHasAFactorAndARadius(): void
    {
        $config = new Game();

        foreach (config('Categories')->names as $category) {
            $this->assertArrayHasKey($category, $config->categories, "No factor for {$category}");
            $this->assertArrayHasKey($category, $config->radiuses, "No radius for {$category}");
            $this->assertGreaterThanOrEqual(1.0, $config->categoryFactor($category));
            $this->assertGreaterThanOrEqual(100, $config->radiusOf($category));
        }

        $this->assertSame($config->radius, $config->radiusOf('unknown'));
    }

    public function testTheMedalFollowsThePlaceOfTheFrozenTable(): void
    {
        $this->assertSame('gold', GameLibrary::medalOf(1));
        $this->assertSame('silver', GameLibrary::medalOf(2));
        $this->assertSame('bronze', GameLibrary::medalOf(3));
        $this->assertSame('participant', GameLibrary::medalOf(4));
        $this->assertSame('participant', GameLibrary::medalOf(250));
    }

    public function testTheTextsOfASeasonFallBackToRussian(): void
    {
        $season = ['title_ru' => 'Зима', 'title_en' => 'Winter', 'description_ru' => 'Текст', 'description_en' => null];

        $this->assertSame('Зима', GameLibrary::localized($season, 'title', 'ru'));
        $this->assertSame('Winter', GameLibrary::localized($season, 'title', 'en'));
        $this->assertSame('Текст', GameLibrary::localized($season, 'description', 'en'));
        $this->assertNull(GameLibrary::localized(['description_ru' => '', 'description_en' => null], 'description', 'ru'));
    }

    public function testNearThePlaceIsTheRadiusOfItsCategoryPlusTheAccuracy(): void
    {
        // About 111 m per 0.001° of latitude
        $this->assertEqualsWithDelta(111, GameLibrary::distance(53.1, 57.2, 53.101, 57.2), 1);
        $this->assertSame(0, GameLibrary::distance(53.1, 57.2, 53.1, 57.2));

        $game     = new GameLibrary();
        $memorial = (object) ['lat' => 53.1, 'lon' => 57.2, 'category' => 'memorial'];
        $lake     = (object) ['lat' => 53.1, 'lon' => 57.2, 'category' => 'water'];

        // 333 m from a memorial (200 m): far; from a lake (3 km): near
        $this->assertFalse($game->isNear($memorial, 53.103, 57.2)[0]);
        $this->assertTrue($game->isNear($lake, 53.103, 57.2)[0]);
        // A poor fix adds its accuracy, capped: 333 m is within 200 + 150, 444 m is not whatever it reports
        $this->assertTrue($game->isNear($memorial, 53.103, 57.2, 140.0)[0]);
        $this->assertFalse($game->isNear($memorial, 53.104, 57.2, 5000.0)[0]);
        $this->assertEqualsWithDelta(333, $game->isNear($memorial, 53.103, 57.2)[1], 2);
    }

    public function testANeighbourCutsTheRadiusAndTheAccuracy(): void
    {
        $config = new Game();

        // Nobody near: the category's
        $this->assertSame(['radius' => 200, 'slack' => 150], GameLibrary::zone(200, null, $config));
        // A place 192 m away: 60% of the way, half of it for the accuracy — 172 m, short of the neighbour
        $this->assertSame(['radius' => 115, 'slack' => 57], GameLibrary::zone(200, 192, $config));
        // Far enough not to matter
        $this->assertSame(['radius' => 200, 'slack' => 150], GameLibrary::zone(200, 400, $config));
        // Never below the floor
        $this->assertSame(['radius' => 75, 'slack' => 37], GameLibrary::zone(200, 20, $config));

        $memorial = (object) ['lat' => 53.1, 'lon' => 57.2, 'category' => 'memorial'];
        $zone     = GameLibrary::zone(200, 192, $config);
        // 111 m: near; 167 m with a poor fix: 115 + 57; at the neighbour (192 m): never
        $this->assertTrue(GameLibrary::near($memorial, $zone, null, 53.101, 57.2, null, $config)[0]);
        $this->assertTrue(GameLibrary::near($memorial, $zone, null, 53.1015, 57.2, 500.0, $config)[0]);
        $this->assertFalse(GameLibrary::near($memorial, $zone, null, 53.10173, 57.2, 500.0, $config)[0]);
    }

    public function testTheShotMomentOfAPhotoIsReadOnlyFromARealDate(): void
    {
        helper('exif');

        $this->assertNull(getPhotoTakenAt('/no/such/file.jpg'));
        // Not a JPEG or TIFF: no EXIF to read, no warning
        $this->assertNull(getPhotoTakenAt(__FILE__));
    }
}
