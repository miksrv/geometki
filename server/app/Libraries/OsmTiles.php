<?php

namespace App\Libraries;

use Config\OsmCandidates;

/**
 * Tile math for OSM candidates: the map is cut into square tiles of `tileSize` degrees,
 * a tile is the unit of collection. A tile is addressed by floor(lat / size), floor(lon / size).
 *
 * @package App\Libraries
 */
class OsmTiles
{
    private float $size;

    public function __construct(?OsmCandidates $config = null)
    {
        $this->size = ($config ?? config('OsmCandidates'))->tileSize;
    }

    /**
     * @return array{0: int, 1: int} tile_lat, tile_lon
     */
    public function tileOf(float $lat, float $lon): array
    {
        // A tiny epsilon keeps 51.2 / 0.1 = 511.99999… in tile 512
        return [(int) floor($lat / $this->size + 1e-9), (int) floor($lon / $this->size + 1e-9)];
    }

    /**
     * Tile index ranges covering the bounds
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds south, west, north, east
     * @return array{0: int, 1: int, 2: int, 3: int} from lat, from lon, to lat, to lon
     */
    private function tileRange(array $bounds): array
    {
        [$south, $west, $north, $east] = $bounds;
        [$fromLat, $fromLon] = $this->tileOf($south, $west);
        [$toLat, $toLon]     = $this->tileOf($north, $east);

        // A bound exactly on a tile edge does not take the next tile
        if ($toLat > $fromLat && abs($north / $this->size - $toLat) < 1e-9) {
            $toLat--;
        }

        if ($toLon > $fromLon && abs($east / $this->size - $toLon) < 1e-9) {
            $toLon--;
        }

        return [$fromLat, $fromLon, $toLat, $toLon];
    }

    /**
     * How many tiles cover the bounds, without listing them
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds south, west, north, east
     */
    public function countInBounds(array $bounds): int
    {
        [$fromLat, $fromLon, $toLat, $toLon] = $this->tileRange($bounds);

        return ($toLat - $fromLat + 1) * ($toLon - $fromLon + 1);
    }

    /**
     * Tiles covering the bounds
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds south, west, north, east
     * @return array<int, array{0: int, 1: int}>
     */
    public function tilesInBounds(array $bounds): array
    {
        [$fromLat, $fromLon, $toLat, $toLon] = $this->tileRange($bounds);

        $tiles = [];

        for ($lat = $fromLat; $lat <= $toLat; $lat++) {
            for ($lon = $fromLon; $lon <= $toLon; $lon++) {
                $tiles[] = [$lat, $lon];
            }
        }

        return $tiles;
    }

    /**
     * @return array{0: float, 1: float, 2: float, 3: float} south, west, north, east
     */
    public function tileBounds(int $tileLat, int $tileLon): array
    {
        return [
            round($tileLat * $this->size, 6),
            round($tileLon * $this->size, 6),
            round(($tileLat + 1) * $this->size, 6),
            round(($tileLon + 1) * $this->size, 6),
        ];
    }

    public function contains(int $tileLat, int $tileLon, float $lat, float $lon): bool
    {
        return $this->tileOf($lat, $lon) === [$tileLat, $tileLon];
    }

    /**
     * Parses "south,west,north,east" from a request
     *
     * @return array{0: float, 1: float, 2: float, 3: float}|null
     */
    public static function parseBounds(?string $value): ?array
    {
        $parts = array_map('floatval', explode(',', (string) $value));

        if (count($parts) !== 4) {
            return null;
        }

        [$south, $west, $north, $east] = $parts;

        if (
            $south >= $north || $west >= $east ||
            abs($south) > 90 || abs($north) > 90 || abs($west) > 180 || abs($east) > 180
        ) {
            return null;
        }

        return $parts;
    }
}
