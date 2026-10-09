<?php

namespace App\Libraries;

use App\Entities\LocationCountryEntity;
use App\Entities\LocationDistrictEntity;
use App\Entities\LocationLocalityEntity;
use App\Entities\LocationRegionEntity;
use App\Models\LocationAliasesModel;
use App\Models\LocationCountriesModel;
use App\Models\LocationDistrictsModel;
use App\Models\LocationLocalitiesModel;
use App\Models\LocationRegionsModel;
use App\Models\LocationSlugsModel;
use Config\Services;
use Geocoder\Exception\Exception;
use Geocoder\Provider\Nominatim\Nominatim;
use Geocoder\Provider\Yandex\Yandex;
use Geocoder\Query\GeocodeQuery;
use Geocoder\StatefulGeocoder;
use GuzzleHttp\Client;
use ReflectionException;

 /**
  * Class Geocoder
  *
  * search() does free-text forward geocoding via geocoder-php/Nominatim, unchanged.
  *
  * coordinates() reverse-geocodes a point directly against the Nominatim HTTP API
  * (via NominatimClient), in three calls for the common case:
  *   1. reverse(lang=ru, no zoom) — full detail: the matched feature's own osm
  *      id (used as the anchor for call 3), plus the Russian-localized address
  *      breakdown (country/state/county/city/road/house_number) and the
  *      country/region ISO codes.
  *   2. reverse(lang=en, no zoom) — the same address breakdown in English.
  *   3. details(matched osm id) — the ancestor administrative hierarchy, each
  *      with its OWN osm_type/osm_id (reverse only gives that for the matched
  *      feature, not its ancestors) — see NominatimClient::details().
  * A level missing from call 3's hierarchy (rare — e.g. the matched feature
  * has no usable osm id, or the hierarchy genuinely does not cover it) falls
  * back to one extra zoom-scoped reverse call (as before) for just that
  * level; district/locality fallback calls are skipped entirely when their
  * result would be discarded anyway (no region resolved yet for district, no
  * name at all for locality).
  *
  * Each level is resolved against the database in a fixed order — existing
  * OSM id → ISO code (country/region) → normalized-name alias within the
  * parent → create new — implemented by matchLocation() and
  * App\Libraries\LocationMatcher. A location's title_en/title_ru are set
  * only when it is created; an existing match is never overwritten with a
  * new name, only recorded as an additional alias (see
  * App\Models\LocationAliasesModel).
  *
  * One Geocoder instance caches hierarchy fallback responses in memory for
  * its own lifetime, keyed by zoom and coordinates rounded to a per-level
  * precision. `php spark locations:rebuild` reuses a single instance for its
  * whole run so neighbouring places short-circuit repeat fallback calls —
  * the single live request from Places::create()/update() does not benefit
  * from this (nothing to reuse across one call) but is unaffected by it.
  *
  * @package App\Libraries
  * @link https://geocoder-php.org/docs/providers/nominatim/
  * @link https://nominatim.org/release-docs/latest/api/Reverse/
  * @link https://nominatim.org/release-docs/latest/api/Details/
  */
class Geocoder{
    /** @var int|null */
    public ?int $countryId = null;

    /** @var int|null */
    public ?int $regionId = null;

    /** @var int|null */
    public ?int $districtId = null;

    /** @var int|null */
    public ?int $localityId = null;

    /** @var string */
    public string $addressEn = '';

    /** @var string */
    public string $addressRu = '';

    private Client $httpClient;

    private \CodeIgniter\HTTP\IncomingRequest|\CodeIgniter\HTTP\CLIRequest $requestApi;

    private Nominatim|Yandex $provider;

    private NominatimClient $nominatimClient;

    private \Config\LocationSlugs $slugConfig;

    /** @var array<string, array|null> zoom:lat:lon => decoded Nominatim response (or null); fallback calls only */
    private array $hierarchyCache = [];

    /** Nominatim's own rank_address scale (not raw OSM admin_level, which varies by country) for region/district */
    private const REGION_RANK_RANGE   = [7, 10];
    private const DISTRICT_RANK_RANGE = [11, 13];

    /** place-class types counted as a "locality" (excludes sub-city suburb/neighbourhood) */
    private const LOCALITY_TYPES = ['city', 'town', 'village', 'hamlet'];

    /** address-breakdown keys that name the locality, most specific first */
    private const LOCALITY_ADDRESS_KEYS = ['city', 'town', 'village', 'hamlet'];

    /**
     * highway types whose name is a trail/track name, not a street: when the
     * point Nominatim matched is one of these, its `road` ("легкий заход",
     * "(Заросшая дорога)") must not become the place's street address.
     */
    private const PATH_LIKE_HIGHWAY_TYPES = ['path', 'track', 'footway', 'cycleway', 'bridleway', 'steps', 'trail'];

    private const USER_AGENT = 'Geometki/1.0 (https://geometki.com)';

    public function __construct(?NominatimClient $nominatimClient = null)
    {
        $this->httpClient = new Client();
        $this->requestApi = Services::request();
        $this->provider    = Nominatim::withOpenStreetMapServer($this->httpClient, self::USER_AGENT);
        $this->nominatimClient = $nominatimClient ?? new NominatimClient();
        $this->slugConfig = config('LocationSlugs');
    }

    /**
     * Searches for locations based on the provided text (forward geocoding,
     * unrelated to coordinates()/the admin-level matching below). Unchanged.
     *
     * @param string $text
     * @return array
     * @throws Exception
     */
    public function search($text): array
    {
        $result    = [];
        $geocoder  = new StatefulGeocoder($this->provider, $this->requestApi->getLocale());
        $locations = $geocoder->geocodeQuery(GeocodeQuery::create($text))->all();

        if (empty($locations)) {
            return $result;
        }

        foreach ($locations as $location) {
            if (!$location->getLocality()) {
                continue;
            }

            $data  = [
                'lat' => $location->getCoordinates()->getLatitude(),
                'lon' => $location->getCoordinates()->getLongitude(),
                'locality' => $location->getLocality(),
            ];

            if ($location->getCountry()) {
                $data['country'] = $location->getCountry()->getName();
            }

            if ($location->getAdminLevels()->has(1)) {
                $data['region'] = $location->getAdminLevels()->get(1)->getName();
            }

            if ($location->getAdminLevels()->has(2)) {
                $data['district'] = $location->getAdminLevels()->get(2)->getName();
            }

            if ($location->getStreetName()) {
                $data['street'] = $location->getStreetName() . ($location->getStreetNumber() ? ', ' . $location->getStreetNumber() : '');
            }

            $result[] = $data;
        }

        return $result;
    }

    /**
     * Reverse-geocodes coordinates: resolves/creates the country, region,
     * district and locality, and the localized street address. Three
     * Nominatim requests in the common case — see the class docblock.
     *
     * @param float $lat
     * @param float $lng
     * @return bool false when Nominatim has nothing at all for this point (e.g. open ocean)
     * @throws ReflectionException
     */
    public function coordinates(float $lat, float $lng): bool
    {
        helper('location');
        helper('slug');

        $ruResponse = $this->nominatimClient->reverse($lat, $lng, null, 'ru');

        if (!$ruResponse) {
            return false;
        }

        $enResponse = $this->nominatimClient->reverse($lat, $lng, null, 'en');

        $this->addressRu = $this->formatStreetAddress($ruResponse);
        $this->addressEn = $this->formatStreetAddress($enResponse);

        $matchedOsmType = $this->extractOsmType($ruResponse);
        $matchedOsmId   = $this->extractOsmId($ruResponse);
        $hierarchy      = ($matchedOsmType && $matchedOsmId)
            ? $this->nominatimClient->details($matchedOsmType, $matchedOsmId)
            : null;

        $addressRuBreakdown = $ruResponse['address'] ?? [];
        $addressEnBreakdown = $enResponse['address'] ?? [];

        // --- Country: no osm id comes back from details() for the country
        // entry (verified live), so identity relies on the ISO code / alias.
        $this->countryId = $this->resolveCountry(
            $this->extractCountryIso($ruResponse),
            $addressRuBreakdown['country'] ?? null,
            $addressEnBreakdown['country'] ?? null
        );

        if (!$this->countryId) {
            return false;
        }

        // --- Region ---
        $regionEntry = $this->pickHierarchyEntry($hierarchy, self::REGION_RANK_RANGE);

        if (!$regionEntry) {
            $regionEntry = $this->reverseWithCache($lat, $lng, $this->slugConfig->reverseZoomByType['region']);
        }

        $this->regionId = $this->resolveRegion(
            $this->extractOsmType($regionEntry),
            $this->extractOsmId($regionEntry),
            $this->extractRegionIso($ruResponse),
            $addressRuBreakdown['state'] ?? null,
            $addressEnBreakdown['state'] ?? null
        );

        // --- District (requires a region; skip the fallback call otherwise — it would be discarded) ---
        if ($this->regionId) {
            $districtEntry = $this->pickHierarchyEntry($hierarchy, self::DISTRICT_RANK_RANGE);

            if (!$districtEntry) {
                $districtEntry = $this->reverseWithCache($lat, $lng, $this->slugConfig->reverseZoomByType['district']);
            }

            $this->districtId = $this->resolveDistrict(
                $this->extractOsmType($districtEntry),
                $this->extractOsmId($districtEntry),
                $addressRuBreakdown['county'] ?? $addressRuBreakdown['state_district'] ?? null,
                $addressEnBreakdown['county'] ?? $addressEnBreakdown['state_district'] ?? null
            );
        } else {
            $this->districtId = null;
        }

        // --- Locality (independent of district/region) ---
        $localityNameRu = $this->pickLocalityName($addressRuBreakdown);
        $localityNameEn = $this->pickLocalityName($addressEnBreakdown);

        if ($localityNameRu || $localityNameEn) {
            $localityEntry = $this->pickLocalityEntry($hierarchy);

            // Only worth a fallback call when we know there IS a settlement
            // here but details() did not resolve its osm id — not when there
            // is simply no locality at this point (its result would be discarded).
            if (!$this->extractOsmId($localityEntry)) {
                $localityEntry = $this->reverseWithCache($lat, $lng, $this->slugConfig->reverseZoomByType['locality']) ?? $localityEntry;
            }

            $this->localityId = $this->resolveLocality(
                $this->extractOsmType($localityEntry),
                $this->extractOsmId($localityEntry),
                $localityNameRu,
                $localityNameEn
            );
        } else {
            $this->localityId = null;
        }

        return true;
    }

    // -------------------------------------------------------------------------
    // Per-level resolution
    // -------------------------------------------------------------------------

    /**
     * @throws ReflectionException
     */
    private function resolveCountry(?string $isoCode, ?string $nameRu, ?string $nameEn): ?int
    {
        $model = new LocationCountriesModel();

        return $this->matchLocation(
            $model,
            'country',
            null,
            null,
            $isoCode,
            0,
            $nameRu,
            $nameEn,
            function (string $finalNameEn, string $finalNameRu) use ($model, $isoCode) {
                $entity = new LocationCountryEntity();
                $entity->iso_code = $isoCode;
                $entity->title_en = mb_substr($finalNameEn, 0, 50, 'UTF-8');
                $entity->title_ru = mb_substr($finalNameRu, 0, 50, 'UTF-8');

                $model->insert($entity);
                $id = $model->getInsertID();

                if ($id) {
                    (new LocationSlugLibrary())->assignForNewLocation('country', $id, $entity->title_ru, []);
                }

                return $id;
            }
        );
    }

    /**
     * @throws ReflectionException
     */
    private function resolveRegion(?string $osmType, ?int $osmId, ?string $isoCode, ?string $nameRu, ?string $nameEn): ?int
    {
        if (!$this->countryId) {
            return null;
        }

        $model = new LocationRegionsModel();

        return $this->matchLocation(
            $model,
            'region',
            $osmType,
            $osmId,
            $isoCode,
            $this->countryId,
            $nameRu,
            $nameEn,
            function (string $finalNameEn, string $finalNameRu) use ($model, $osmType, $osmId, $isoCode) {
                $entity = new LocationRegionEntity();
                $entity->country_id = $this->countryId;
                $entity->osm_type   = $osmType;
                $entity->osm_id     = $osmId;
                $entity->iso_code   = $isoCode;
                $entity->title_en   = mb_substr($finalNameEn, 0, 100, 'UTF-8');
                $entity->title_ru   = mb_substr($finalNameRu, 0, 100, 'UTF-8');

                $model->insert($entity);
                $id = $model->getInsertID();

                if ($id) {
                    $parentChain = array_filter([$this->slugFor('country', $this->countryId)]);
                    (new LocationSlugLibrary())->assignForNewLocation('region', $id, $entity->title_ru, $parentChain);
                }

                return $id;
            }
        );
    }

    /**
     * @throws ReflectionException
     */
    private function resolveDistrict(?string $osmType, ?int $osmId, ?string $nameRu, ?string $nameEn): ?int
    {
        if (!$this->countryId || !$this->regionId) {
            return null;
        }

        $model = new LocationDistrictsModel();

        return $this->matchLocation(
            $model,
            'district',
            $osmType,
            $osmId,
            null,
            $this->regionId,
            $nameRu,
            $nameEn,
            function (string $finalNameEn, string $finalNameRu) use ($model, $osmType, $osmId) {
                $entity = new LocationDistrictEntity();
                $entity->country_id = $this->countryId;
                $entity->region_id  = $this->regionId;
                $entity->osm_type   = $osmType;
                $entity->osm_id     = $osmId;
                $entity->title_en   = mb_substr($finalNameEn, 0, 100, 'UTF-8');
                $entity->title_ru   = mb_substr($finalNameRu, 0, 100, 'UTF-8');

                $model->insert($entity);
                $id = $model->getInsertID();

                if ($id) {
                    $parentChain = array_filter([
                        $this->slugFor('region', $this->regionId),
                        $this->slugFor('country', $this->countryId),
                    ]);
                    (new LocationSlugLibrary())->assignForNewLocation('district', $id, $entity->title_ru, $parentChain);
                }

                return $id;
            }
        );
    }

    /**
     * @throws ReflectionException
     */
    private function resolveLocality(?string $osmType, ?int $osmId, ?string $nameRu, ?string $nameEn): ?int
    {
        if (!$nameRu && !$nameEn) {
            return null;
        }

        $model    = new LocationLocalitiesModel();
        $parentId = $this->districtId ?: ($this->regionId ?: ($this->countryId ?: 0));

        return $this->matchLocation(
            $model,
            'locality',
            $osmType,
            $osmId,
            null,
            $parentId,
            $nameRu,
            $nameEn,
            function (string $finalNameEn, string $finalNameRu) use ($model, $osmType, $osmId) {
                $entity = new LocationLocalityEntity();
                $entity->country_id  = $this->countryId;
                $entity->region_id   = $this->regionId;
                $entity->district_id = $this->districtId;
                $entity->osm_type    = $osmType;
                $entity->osm_id      = $osmId;
                $entity->title_en    = mb_substr($finalNameEn, 0, 100, 'UTF-8');
                $entity->title_ru    = mb_substr($finalNameRu, 0, 100, 'UTF-8');

                $model->insert($entity);
                $insertId = $model->getInsertID();

                if ($insertId > 0) {
                    $parentChain = array_filter([
                        $this->slugFor('district', $this->districtId),
                        $this->slugFor('region', $this->regionId),
                        $this->slugFor('country', $this->countryId),
                    ]);
                    (new LocationSlugLibrary())->assignForNewLocation('locality', $insertId, $entity->title_ru, $parentChain);
                }

                return $insertId;
            }
        );
    }

    // -------------------------------------------------------------------------
    // Shared matching-order logic
    // -------------------------------------------------------------------------

    /**
     * Resolves one location level against the database in the fixed order —
     * osm id → ISO code → normalized-name alias within $parentId → create —
     * via App\Libraries\LocationMatcher, then records every name seen for it
     * as an alias and (only on a match coming from the alias step) backfills
     * osm_type/osm_id onto the row so later lookups use the fast osm-id path.
     *
     * @param object      $model      A Location*Model instance
     * @param string      $type       country|region|district|locality
     * @param string|null $osmType
     * @param int|null    $osmId
     * @param string|null $isoCode    Only meaningful for country/region
     * @param int         $parentId   Alias-matching scope; 0 for country
     * @param string|null $nameRu
     * @param string|null $nameEn
     * @param callable(string, string): int $createRow fn(nameEn, nameRu): new id
     * @return int|null
     * @throws ReflectionException
     */
    private function matchLocation(
        $model,
        string $type,
        ?string $osmType,
        ?int $osmId,
        ?string $isoCode,
        int $parentId,
        ?string $nameRu,
        ?string $nameEn,
        callable $createRow
    ): ?int {
        if (!$nameRu && !$nameEn) {
            return null;
        }

        $osmMatch = null;

        if ($osmType && $osmId) {
            $row = $model->where(['osm_type' => $osmType, 'osm_id' => $osmId])->first();
            $osmMatch = $row->id ?? null;
        }

        $isoMatch = null;

        if ($isoCode && $osmMatch === null) {
            $row = $model->where('iso_code', $isoCode)->first();
            $isoMatch = $row->id ?? null;
        }

        $aliasModel = new LocationAliasesModel();
        $aliasMatch = null;

        if ($osmMatch === null && $isoMatch === null) {
            $normalizedRu = normalizeLocationName($nameRu);
            $normalizedEn = normalizeLocationName($nameEn);

            $alias = $normalizedRu !== '' ? $aliasModel->findMatch($type, $parentId, $normalizedRu) : null;
            $alias = $alias ?? ($normalizedEn !== '' ? $aliasModel->findMatch($type, $parentId, $normalizedEn) : null);
            $aliasMatch = $alias->location_id ?? null;
        }

        $decision = LocationMatcher::resolve($osmMatch, $isoMatch, $aliasMatch);

        if ($decision['strategy'] === LocationMatcher::STRATEGY_CREATE) {
            $finalNameRu = $nameRu ?: $nameEn;
            $finalNameEn = $nameEn ?: $nameRu;

            // No English name in OSM → the lang=en call echoes the Cyrillic
            // one. Transliterate rather than store Cyrillic in title_en.
            if (preg_match('/\p{Cyrillic}/u', $finalNameEn)) {
                $finalNameEn = transliterateLocationTitle($finalNameEn);
            }

            $id = $createRow($finalNameEn, $finalNameRu);

            if (!$id) {
                return null;
            }
        } else {
            $id = $decision['id'];

            // Matched via alias only (not already identified by osm id): heal
            // the row so the next lookup for this exact location is O(1).
            if ($decision['strategy'] === LocationMatcher::STRATEGY_ALIAS && $osmType && $osmId) {
                $model->skipValidation(true)->update($id, ['osm_type' => $osmType, 'osm_id' => $osmId]);
            }
        }

        $aliasModel->remember($type, $id, $parentId, $nameRu);
        $aliasModel->remember($type, $id, $parentId, $nameEn);

        return $id;
    }

    // -------------------------------------------------------------------------
    // Nominatim response parsing
    // -------------------------------------------------------------------------

    /**
     * Normalizes an osm_type coming from either /reverse (full word) or
     * /details' address entries (a single letter: N/W/R — verified live).
     */
    private function extractOsmType(?array $response): ?string
    {
        if (!$response) {
            return null;
        }

        static $map = [
            'node' => 'node', 'way' => 'way', 'relation' => 'relation',
            'n' => 'node', 'w' => 'way', 'r' => 'relation',
        ];

        return $map[mb_strtolower((string) ($response['osm_type'] ?? ''), 'UTF-8')] ?? null;
    }

    private function extractOsmId(?array $response): ?int
    {
        return isset($response['osm_id']) ? (int) $response['osm_id'] : null;
    }

    /**
     * Picks the first boundary/administrative entry in a details() hierarchy
     * whose rank_address (Nominatim's own normalized level scale) falls in
     * the given range — the entries are pre-sorted most-specific-first.
     *
     * @param array|null   $hierarchy A details() response, or null
     * @param array{0:int,1:int} $rankRange [min, max] inclusive
     */
    private function pickHierarchyEntry(?array $hierarchy, array $rankRange): ?array
    {
        foreach ($hierarchy['address'] ?? [] as $entry) {
            if (($entry['class'] ?? null) !== 'boundary' || ($entry['type'] ?? null) !== 'administrative') {
                continue;
            }

            $rank = $entry['rank_address'] ?? null;

            if ($rank !== null && $rank >= $rankRange[0] && $rank <= $rankRange[1]) {
                return $entry;
            }
        }

        return null;
    }

    /**
     * Picks the first place-class settlement entry (city/town/village/
     * hamlet — not a sub-city suburb/neighbourhood) in a details() hierarchy.
     */
    private function pickLocalityEntry(?array $hierarchy): ?array
    {
        foreach ($hierarchy['address'] ?? [] as $entry) {
            if (($entry['class'] ?? null) === 'place' && in_array($entry['type'] ?? null, self::LOCALITY_TYPES, true)) {
                return $entry;
            }
        }

        return null;
    }

    private function extractCountryIso(array $response): ?string
    {
        $code = $response['address']['country_code'] ?? null;

        return (is_string($code) && preg_match('/^[a-z]{2}$/i', $code)) ? strtoupper($code) : null;
    }

    private function extractRegionIso(array $response): ?string
    {
        $code = $response['address']['ISO3166-2-lvl4'] ?? null;

        return (is_string($code) && preg_match('/^[A-Z]{2}-[A-Z0-9]{1,5}$/i', $code)) ? strtoupper($code) : null;
    }

    /**
     * Street address line ("улица Ленина, 5") from a reverse response, or ''
     * when the point has no real street address:
     *  - the matched feature is a trail/track (its `road` is the trail name);
     *  - there is a `road` but no settlement around it and no house number —
     *    a lone highway name ("Миасский тракт") outside any locality is not
     *    an address, and the old provider left these empty too.
     */
    private function formatStreetAddress(?array $response): string
    {
        if (!$response) {
            return '';
        }

        $address = $response['address'] ?? [];
        $road    = trim((string) ($address['road'] ?? ''));
        $house   = trim((string) ($address['house_number'] ?? ''));

        if ($road === '') {
            return '';
        }

        // jsonv2 reverse responses carry `category`; the older json format, `class`.
        $matchedClass = $response['category'] ?? $response['class'] ?? null;

        if ($matchedClass === 'highway' && in_array($response['type'] ?? null, self::PATH_LIKE_HIGHWAY_TYPES, true)) {
            return '';
        }

        if ($house === '' && $this->pickLocalityName($address) === null) {
            return '';
        }

        return $house !== '' ? $road . ', ' . $house : $road;
    }

    /**
     * The settlement name from an address breakdown (city → town → village →
     * hamlet), skipping values that are not usable as a location name
     * (see isUsableLocationName()): a numbered plot labelled as a hamlet
     * must not become a locality row.
     */
    private function pickLocalityName(array $address): ?string
    {
        helper('location');

        foreach (self::LOCALITY_ADDRESS_KEYS as $key) {
            $name = $address[$key] ?? null;

            if (is_string($name) && isUsableLocationName($name)) {
                return $name;
            }
        }

        return null;
    }

    /**
     * In-memory, per-instance cache of fallback hierarchy responses, keyed
     * by zoom and coordinates rounded to a precision appropriate for that
     * admin level — see the class docblock. Only used when details() did
     * not cover a level.
     */
    private function reverseWithCache(float $lat, float $lon, int $zoom): ?array
    {
        $precision = match (true) {
            $zoom <= 3 => 1,
            $zoom <= 5 => 2,
            default    => 3,
        };

        $key = $zoom . ':' . round($lat, $precision) . ':' . round($lon, $precision);

        if (!array_key_exists($key, $this->hierarchyCache)) {
            $this->hierarchyCache[$key] = $this->nominatimClient->reverse($lat, $lon, $zoom, 'ru');
        }

        return $this->hierarchyCache[$key];
    }

    private function slugFor(string $type, ?int $entityId): ?string
    {
        if (!$entityId) {
            return null;
        }

        static $slugsModel = null;
        $slugsModel ??= new LocationSlugsModel();

        return $slugsModel->findFor($type, $entityId)?->slug;
    }
}
