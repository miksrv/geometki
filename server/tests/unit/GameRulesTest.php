<?php

use App\Libraries\GameLibrary;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Game;

/**
 * The numbers of the game (Config\Game) and the pure parts of GameLibrary: the points of a
 * place, the seasons of the calendar, "near the place". No database.
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

    public function testASeasonIsTheWarmOrTheColdHalfOfTheYear(): void
    {
        $cold = GameLibrary::seasonOf('2026-11-11');

        $this->assertSame('2026-cold', $cold['id']);
        $this->assertSame('2026-10-01', $cold['from']);
        $this->assertSame('2027-03-31', $cold['to']);

        $warm = GameLibrary::seasonOf('2026-04-01');

        $this->assertSame('2026-warm', $warm['id']);
        $this->assertSame('2026-04-01', $warm['from']);
        $this->assertSame('2026-09-30', $warm['to']);
        $this->assertSame('2026-warm', GameLibrary::seasonOf('2026-09-30')['id']);

        // A cold season spans two years and is named by the first
        $this->assertSame('2026-cold', GameLibrary::seasonOf('2026-10-01')['id']);
        $this->assertSame('2026-cold', GameLibrary::seasonOf('2027-03-31')['id']);
        $this->assertSame('2025-cold', GameLibrary::seasonOf('2026-01-01')['id']);

        $this->assertSame($cold, GameLibrary::seasonById('2026-cold'));
        $this->assertNull(GameLibrary::seasonById('2026'));
        $this->assertNull(GameLibrary::seasonById('26-cold'));
        $this->assertNull(GameLibrary::seasonById('2026-autumn'));
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

    public function testTheShotMomentOfAPhotoIsReadOnlyFromARealDate(): void
    {
        helper('exif');

        $this->assertNull(getPhotoTakenAt('/no/such/file.jpg'));
        // Not a JPEG or TIFF: no EXIF to read, no warning
        $this->assertNull(getPhotoTakenAt(__FILE__));
    }
}
