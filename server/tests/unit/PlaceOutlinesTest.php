<?php

use App\Libraries\GameLibrary;
use App\Libraries\PlaceOutlines;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Game;

/**
 * @internal
 */
final class PlaceOutlinesTest extends CIUnitTestCase
{
    /** A square lake of about 1.1 × 0.7 km, as OSM gives a closed way */
    private const LAKE = [[53.10, 57.20], [53.10, 57.21], [53.11, 57.21], [53.11, 57.20], [53.10, 57.20]];

    public function testAnOutlineIsNamedLikeThePlaceByAMeaningfulWord(): void
    {
        $this->assertTrue(PlaceOutlines::sameName(['Музей-усадьба «Останкино»'], ['name' => 'Останкинский дворец']));
        $this->assertTrue(PlaceOutlines::sameName(['Озеро Мертвое'], ['name' => 'Мёртвое']));
        $this->assertTrue(PlaceOutlines::sameName(['Рыжий лес (Чернобыль)'], ['name' => 'Рудий ліс', 'name:ru' => 'Рыжий лес']));
        $this->assertTrue(PlaceOutlines::sameName(['Ириклинское водохранилище', 'Iriklinskoye Reservoir'], ['name' => 'Ириклинское водохранилище']));

        // Generic words are not enough, nor is a name of something else
        $this->assertFalse(PlaceOutlines::sameName(['Музей-усадьба Алексея Толстого'], ['name' => 'Набережная реки Волга 1-я очередь']));
        $this->assertFalse(PlaceOutlines::sameName(['Кадаргаванский каньон'], ['name' => 'Цейский заказник']));
        $this->assertFalse(PlaceOutlines::sameName(['Озеро Голубое'], ['name' => 'Озеро Белое']));
        $this->assertFalse(PlaceOutlines::sameName(['Гумеровское ущелье'], ['natural' => 'wood']));
        $this->assertFalse(PlaceOutlines::sameName(['Парк'], ['name' => 'Парк']));
    }

    public function testTheSmallestNamedContainingOutlineIsChosenThenTheNearest(): void
    {
        $tags  = (new Game())->outlineTags['water'];
        $box   = static fn (float $size) => ['minlat' => 53.1, 'minlon' => 57.2, 'maxlat' => 53.1 + $size, 'maxlon' => 57.2 + $size];
        $water = static fn (int $id, string $name, float $size) => [
            'type' => 'way', 'id' => $id, 'bounds' => $box($size), 'tags' => ['natural' => 'water', 'name' => $name],
        ];

        $elements = [
            $water(1, 'Ириклинское водохранилище', 0.5),
            $water(2, 'Ириклинское водохранилище', 0.05),
            ['type' => 'way', 'id' => 3, 'bounds' => $box(0.01), 'tags' => ['landuse' => 'residential', 'name' => 'Ириклинский']],
            ['type' => 'sep'],
            $water(4, 'Ириклинское водохранилище', 0.001),
        ];

        $best = PlaceOutlines::choose($elements, $tags, ['Ириклинское водохранилище'], 53.105, 57.205, 300000);
        $this->assertSame(['type' => 'way', 'id' => 2, 'name' => 'Ириклинское водохранилище'], array_diff_key($best, ['size' => 0]));

        // Nothing contains the point: the nearest one; too large ones never
        $this->assertSame(4, PlaceOutlines::choose(array_slice($elements, 3), $tags, ['Ириклинское'], 53.2, 57.3, 300000)['id']);
        $this->assertNull(PlaceOutlines::choose([$water(1, 'Ириклинское', 5)], $tags, ['Ириклинское'], 53.105, 57.205, 300000));
    }

    public function testTheDistanceToAnOutlineIsZeroInsideAndToTheShoreOutside(): void
    {
        $lake = ['rings' => [self::LAKE], 'lines' => []];

        $this->assertSame(0, PlaceOutlines::distanceTo($lake, 53.105, 57.205));
        // 0.001° of latitude south of the shore: about 111 m
        $this->assertEqualsWithDelta(111, PlaceOutlines::distanceTo($lake, 53.099, 57.205), 2);

        // An island (an inner ring) is outside the water
        $island = [[53.104, 57.204], [53.104, 57.206], [53.106, 57.206], [53.106, 57.204], [53.104, 57.204]];
        $this->assertFalse(PlaceOutlines::contains([self::LAKE, $island], 53.105, 57.205));

        // A ring split into two lines (a relation's members) still has an inside
        $this->assertTrue(PlaceOutlines::contains([array_slice(self::LAKE, 0, 3), array_slice(self::LAKE, 2)], 53.105, 57.205));

        // A cliff is a line: only its distance counts
        $cliff = ['rings' => [], 'lines' => [[[53.10, 57.20], [53.10, 57.21]]]];
        $this->assertEqualsWithDelta(111, PlaceOutlines::distanceTo($cliff, 53.101, 57.205), 2);
    }

    public function testAGeometryIsReadFromOverpassAndSimplified(): void
    {
        $points = static fn (array $list) => array_map(static fn ($p) => ['lat' => $p[0], 'lon' => $p[1]], $list);

        $way = PlaceOutlines::geometry(['type' => 'way', 'geometry' => $points(self::LAKE)]);
        $this->assertCount(1, $way['rings']);
        $this->assertSame([], $way['lines']);

        $relation = PlaceOutlines::geometry([
            'type'    => 'relation',
            'tags'    => ['type' => 'multipolygon'],
            'members' => [
                ['type' => 'way', 'role' => 'outer', 'geometry' => $points(array_slice(self::LAKE, 0, 3))],
                ['type' => 'way', 'role' => 'outer', 'geometry' => $points(array_slice(self::LAKE, 2))],
                ['type' => 'node', 'role' => 'label'],
            ],
        ]);
        $this->assertCount(2, $relation['rings']);

        // Points on a straight shore go, the corners stay
        $line = [[53.10, 57.20], [53.10, 57.201], [53.10, 57.202], [53.10, 57.203], [53.11, 57.203]];
        $this->assertSame([[53.10, 57.20], [53.10, 57.203], [53.11, 57.203]], PlaceOutlines::simplify($line, 5));

        // Thousands of pieces never get under the limit: it stops anyway
        $pieces = array_fill(0, 2500, [[53.10, 57.20], [53.10, 57.201], [53.11, 57.201]]);
        $this->assertCount(2500, PlaceOutlines::simplifyAll(['rings' => $pieces, 'lines' => []], 1000)['rings']);
    }

    public function testNearIsNearTheOutlineToo(): void
    {
        $config = new Game();
        $lake   = (object) ['lat' => 53.105, 'lon' => 57.205, 'category' => 'water'];
        $zone   = GameLibrary::zone($config->radiusOf('water'), null, $config);
        $shape  = ['rings' => [self::LAKE], 'lines' => []];

        // 5.5 km from the point, 4.4 km from the shore: far; with the shore 111 m away: near
        [$near, $distance] = GameLibrary::near($lake, $zone, $shape, 53.15, 57.205, null, $config);
        $this->assertFalse($near);
        $this->assertEqualsWithDelta(4440, $distance, 30);

        $long = ['rings' => [[[53.10, 57.20], [53.10, 57.30], [53.20, 57.30], [53.20, 57.20], [53.10, 57.20]]], 'lines' => []];
        [$near, $distance] = GameLibrary::near($lake, $zone, $long, 53.201, 57.25, null, $config);
        $this->assertTrue($near);
        $this->assertEqualsWithDelta(111, $distance, 2);
    }
}
