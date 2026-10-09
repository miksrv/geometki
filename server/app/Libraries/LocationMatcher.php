<?php

namespace App\Libraries;

/**
 * Pure decision logic for the geocoder's matching order (see "Decisions
 * already made by the owner" in the location-dedup task): an existing OSM-id
 * match wins over an ISO-code match (country/region only), which wins over a
 * normalized-name alias match within the same parent, which wins over
 * creating a new location.
 *
 * Takes already-fetched lookup results so it has no DB/HTTP dependency and
 * is fully unit-testable — App\Libraries\Geocoder does the three lookups
 * (in order, short-circuiting once one hits) and feeds the results here.
 */
class LocationMatcher
{
    public const STRATEGY_OSM_ID   = 'osm_id';
    public const STRATEGY_ISO_CODE = 'iso_code';
    public const STRATEGY_ALIAS    = 'alias';
    public const STRATEGY_CREATE   = 'create';

    /**
     * @param int|null $osmIdMatch   Existing location id found by (osm_type, osm_id), or null
     * @param int|null $isoCodeMatch Existing location id found by ISO code, or null (only meaningful for country/region)
     * @param int|null $aliasMatch   Existing location id found by a normalized-name alias within the parent, or null
     * @return array{strategy: string, id: int|null}
     */
    public static function resolve(?int $osmIdMatch, ?int $isoCodeMatch, ?int $aliasMatch): array
    {
        if ($osmIdMatch !== null) {
            return ['strategy' => self::STRATEGY_OSM_ID, 'id' => $osmIdMatch];
        }

        if ($isoCodeMatch !== null) {
            return ['strategy' => self::STRATEGY_ISO_CODE, 'id' => $isoCodeMatch];
        }

        if ($aliasMatch !== null) {
            return ['strategy' => self::STRATEGY_ALIAS, 'id' => $aliasMatch];
        }

        return ['strategy' => self::STRATEGY_CREATE, 'id' => null];
    }
}
