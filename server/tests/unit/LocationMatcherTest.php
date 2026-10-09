<?php

use App\Libraries\LocationMatcher;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for App\Libraries\LocationMatcher::resolve() — the geocoder's fixed
 * matching order: osm id -> ISO code -> normalized-name alias -> create new.
 * Pure PHP: the three lookup results are passed in directly, no DB.
 *
 * @internal
 */
final class LocationMatcherTest extends CIUnitTestCase
{
    public function testOsmIdMatchWinsOverEverything(): void
    {
        $result = LocationMatcher::resolve(1, 225, 999);

        $this->assertSame(LocationMatcher::STRATEGY_OSM_ID, $result['strategy']);
        $this->assertSame(1, $result['id']);
    }

    public function testIsoCodeMatchWinsWhenThereIsNoOsmIdMatch(): void
    {
        $result = LocationMatcher::resolve(null, 2, 999);

        $this->assertSame(LocationMatcher::STRATEGY_ISO_CODE, $result['strategy']);
        $this->assertSame(2, $result['id']);
    }

    public function testAliasMatchWinsWhenNeitherOsmIdNorIsoMatch(): void
    {
        $result = LocationMatcher::resolve(null, null, 78);

        $this->assertSame(LocationMatcher::STRATEGY_ALIAS, $result['strategy']);
        $this->assertSame(78, $result['id']);
    }

    public function testCreateWhenNothingMatches(): void
    {
        $result = LocationMatcher::resolve(null, null, null);

        $this->assertSame(LocationMatcher::STRATEGY_CREATE, $result['strategy']);
        $this->assertNull($result['id']);
    }

    public function testOsmIdMatchWinsOverIsoCodeAlone(): void
    {
        $result = LocationMatcher::resolve(5, 9, null);

        $this->assertSame(LocationMatcher::STRATEGY_OSM_ID, $result['strategy']);
        $this->assertSame(5, $result['id']);
    }

    public function testIsoCodeMatchWinsOverAliasAlone(): void
    {
        $result = LocationMatcher::resolve(null, 9, 5);

        $this->assertSame(LocationMatcher::STRATEGY_ISO_CODE, $result['strategy']);
        $this->assertSame(9, $result['id']);
    }
}
