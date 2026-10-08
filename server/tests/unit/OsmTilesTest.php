<?php

use App\Libraries\OsmTiles;
use CodeIgniter\Test\CIUnitTestCase;
use Config\OsmCandidates;

/**
 * Unit tests for App\Libraries\OsmTiles — the tile grid of the OSM candidates collection.
 * Pure PHP, no DB.
 *
 * @internal
 */
final class OsmTilesTest extends CIUnitTestCase
{
    private OsmTiles $tiles;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tiles = new OsmTiles(new OsmCandidates());
    }

    public function testTileOfFloorsCoordinates(): void
    {
        $this->assertSame([511, 549], $this->tiles->tileOf(51.15, 54.98));
        $this->assertSame([-1, -1], $this->tiles->tileOf(-0.05, -0.05));
    }

    public function testTileEdgeBelongsToTheUpperTile(): void
    {
        $this->assertSame([512, 550], $this->tiles->tileOf(51.2, 55.0));
    }

    public function testTilesInBoundsCoverTheArea(): void
    {
        $tiles = $this->tiles->tilesInBounds([51.12, 54.95, 51.18, 55.05]);

        $this->assertSame([[511, 549], [511, 550]], $tiles);
    }

    public function testBoundOnTileEdgeDoesNotTakeTheNextTile(): void
    {
        $this->assertCount(4, $this->tiles->tilesInBounds([51.1, 54.9, 51.3, 55.1]));
    }

    public function testTileBounds(): void
    {
        $this->assertSame([51.1, 54.9, 51.2, 55.0], $this->tiles->tileBounds(511, 549));
    }

    public function testParseBoundsRejectsInvalidInput(): void
    {
        $this->assertNull(OsmTiles::parseBounds(null));
        $this->assertNull(OsmTiles::parseBounds('1,2,3'));
        $this->assertNull(OsmTiles::parseBounds('51.2,55,51.1,56'));
        $this->assertNull(OsmTiles::parseBounds('95,55,96,56'));
        $this->assertSame([51.1, 54.9, 51.2, 55.1], OsmTiles::parseBounds('51.1,54.9,51.2,55.1'));
    }
}
