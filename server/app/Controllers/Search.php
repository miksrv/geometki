<?php

namespace App\Controllers;

use App\Libraries\Geocoder;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SearchPlacesRanking;
use App\Libraries\SearchSuggestions;
use App\Libraries\SessionLibrary;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;
use Geocoder\Exception\Exception;
use Throwable;

/**
 * Search controller
 *
 * Provides two endpoints:
 *  - GET /search        Full structured search across places, geocoder locations and coordinates.
 *  - GET /search/suggest  Autocomplete suggestions for the site search: places, locations, addresses.
 *
 * @package App\Controllers
 */
class Search extends ResourceController
{
    // The most relevant found places the filter and the sort work over: nobody pages further,
    // the counts are still over all of them
    private const SEARCH_PLACES     = 50;
    private const SUGGEST_PLACES    = 5;
    private const SUGGEST_AREAS     = 3;
    // Rows per location level before rankAreas() puts names starting with the query first
    private const SUGGEST_AREA_ROWS = 10;
    private const SUGGEST_ADDRESSES = 2;

    /**
     * Full search across places, geocoder locations, and coordinate detection.
     *
     * GET /search?q=&type=all|location|coordinates|places&category=a,b&sort=&order=&lat=&lon=&limit=20&offset=0
     *
     * `places.categories` counts the found places per category before the category filter (the
     * client's facets) and `places.count` all found places with the filter — both over every
     * match. The sort runs over the SEARCH_PLACES most relevant of them (`places.available`, what
     * the pages reach) in its natural direction unless `order` is given, then the page is cut.
     *
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function index(): ResponseInterface
    {
        $q        = $this->request->getGet('q', FILTER_SANITIZE_SPECIAL_CHARS);
        $type     = $this->request->getGet('type', FILTER_SANITIZE_SPECIAL_CHARS) ?? 'all';
        $category = $this->request->getGet('category', FILTER_SANITIZE_SPECIAL_CHARS);
        $sort     = $this->request->getGet('sort', FILTER_SANITIZE_SPECIAL_CHARS);
        $order    = $this->request->getGet('order', FILTER_SANITIZE_SPECIAL_CHARS);
        $lat      = $this->request->getGet('lat', FILTER_VALIDATE_FLOAT);
        $lon      = $this->request->getGet('lon', FILTER_VALIDATE_FLOAT);
        $limit    = min(abs((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 20)), 40);
        $offset   = abs((int) ($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0));
        $locale   = $this->request->getLocale();

        $result = [
            'locations'   => ['items' => [], 'count' => 0],
            'places'      => ['items' => [], 'count' => 0],
        ];

        if (!$q || mb_strlen(trim($q)) <= 2) {
            return $this->respond($result);
        }

        $q = trim($q);

        // --- Coordinate detection ---
        $coordinates = $this->parseCoordinates($q);
        if ($coordinates) {
            // The query itself is a point; without it `coordinates` is the top result's point
            $result['coordinates'] = $coordinates + ['parsed' => true];
        }

        // --- Geocoder locations ---
        if ($type === 'all' || $type === 'location') {
            $geocoder        = new Geocoder();
            $geoItems        = $geocoder->search($q);
            $geoSlice        = array_slice($geoItems, 0, 5);
            $result['locations'] = [
                'items' => $geoSlice,
                'count' => count($geoSlice),
            ];
        }

        // --- Places full-text search ---
        if ($type === 'all' || $type === 'places') {
            $placeContent = new PlacesContent(350);

            // Exact counts over every match; the rows themselves only for the most relevant ones
            $found      = $placeContent->countByCategory($q);
            $facets     = array_filter($found, static fn ($key) => $key !== '', ARRAY_FILTER_USE_KEY);
            $categories = $category
                ? array_values(array_intersect(array_map('trim', explode(',', $category)), config('Categories')->names))
                : [];

            $placeContent->search($q, self::SEARCH_PLACES, $categories, false);

            $allPlaceIds = $placeContent->placeIds;

            $distanceSQL = '';
            if ($lat && $lon) {
                $distanceSQL = (new PlacesModel())->makeDistanceSQL($lat, $lon);
            }
            $coordinatesAvailable = $distanceSQL !== '';

            // One light query over the loaded places: the sort is over all of them, the page
            // is cut after it
            $rows = [];
            if (!empty($allPlaceIds)) {
                $byId = [];
                $light = (new PlacesModel())
                    ->select('id, category, views, rating, comments, created_at' . $distanceSQL)
                    ->whereIn('id', $allPlaceIds)
                    ->asArray()
                    ->findAll();

                foreach ($light as $row) {
                    $byId[$row['id']] = $row;
                }

                // The full-text relevance order; soft-deleted places drop out here
                foreach ($allPlaceIds as $id) {
                    if (isset($byId[$id])) {
                        $rows[] = $byId[$id];
                    }
                }
            }


            if (!$sort) {
                $sort = $coordinatesAvailable ? 'distance' : 'relevance';
            }
            if ($sort === 'distance' && !$coordinatesAvailable) {
                $sort = 'relevance';
            }
            $rows = SearchPlacesRanking::sort($rows, $sort, $order);

            $totalCount = $categories
                ? array_sum(array_intersect_key($facets, array_flip($categories)))
                : array_sum($found);
            $pagedIds   = array_column(array_slice($rows, $offset, $limit), 'id');

            // The texts of the page only
            $placeContent->translate($pagedIds);

            $formattedPlaces = [];

            if (!empty($pagedIds)) {
                $placesModel = new PlacesModel();
                $placesModel->applyListSelect($distanceSQL);
                $placesById = [];
                foreach ($placesModel->whereIn('places.id', $pagedIds)->findAll() as $place) {
                    $placesById[$place->id] = $place;
                }

                $formatter = new PlaceFormatterLibrary();
                foreach ($pagedIds as $id) {
                    $place = $placesById[$id] ?? null;
                    if (!$place) {
                        continue;
                    }

                    if ($coordinatesAvailable && isset($place->distance) && $place->distance !== null) {
                        $place->distance = $formatter->formatDistance($place->distance);
                    }

                    $formatter->formatListRow(
                        $place,
                        $locale,
                        $placeContent->title($place->id),
                        $placeContent->content($place->id)
                    );

                    $formattedPlaces[] = $place;
                }
            }

            if ($formattedPlaces) {
                (new PlaceFormatterLibrary())->markVisitorState($formattedPlaces, (new SessionLibrary())->user?->id);
            }

            $result['places'] = [
                'items'      => $formattedPlaces,
                'count'      => $totalCount,
                'available'  => count($rows),
                'categories' => (object) $facets,
            ];
        }

        if (!empty($result['coordinates'])) {
            // Coordinates parsed from the query string — attach geocoder context if available.
            if (!empty($result['locations']['items'][0])) {
                $loc0  = $result['locations']['items'][0];
                $parts = array_filter([
                    $loc0['locality'] ?? null,
                    $loc0['region']   ?? null,
                    $loc0['country']  ?? null,
                ]);
                $secondary = implode(', ', $parts) ?: null;
                if ($secondary) {
                    $result['coordinates']['secondary'] = $secondary;
                }
            }
        } else {
            // Derive fallback coordinates from the most relevant result.
            $firstPlace = $result['places']['items'][0] ?? null;

            if ($firstPlace && isset($firstPlace->lat, $firstPlace->lon)) {
                // Use the place's own address — never mix with geocoder results.
                $secondary = null;
                if (isset($firstPlace->address)) {
                    $addr  = $firstPlace->address;
                    $parts = array_filter([
                        $addr->locality['name'] ?? null,
                        $addr->region['name']   ?? null,
                        $addr->country['name']  ?? null,
                    ]);
                    $secondary = implode(', ', $parts) ?: null;
                }

                $result['coordinates'] = [
                    'lat'       => (float) $firstPlace->lat,
                    'lon'       => (float) $firstPlace->lon,
                    'secondary' => $secondary,
                ];
            } elseif (!empty($result['locations']['items'][0]['lat'])) {
                $loc   = $result['locations']['items'][0];
                $parts = array_filter([
                    $loc['locality'] ?? null,
                    $loc['region']   ?? null,
                    $loc['country']  ?? null,
                ]);
                $result['coordinates'] = [
                    'lat'       => (float) $loc['lat'],
                    'lon'       => (float) $loc['lon'],
                    'secondary' => implode(', ', $parts) ?: null,
                ];
            }
        }

        return $this->respond($result);
    }

    /**
     * Autocomplete suggestions for the site search (the app bar, the home page).
     *
     * In this order: the point when the query parses as coordinates, up to 5 places (with
     * the category and the locality and region names), up to 3 of the site's own locations
     * with places (`area`: their places listing, the count, the parent region), and only
     * without them up to 2 geocoder addresses (`location`: a point on the map, with the
     * region and country).
     *
     * GET /search/suggest?q=
     *
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function suggest(): ResponseInterface
    {
        $q = $this->request->getGet('q', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$q || mb_strlen(trim($q)) <= 2) {
            return $this->respond(['suggestions' => []]);
        }

        $q           = trim($q);
        $locale      = $this->request->getLocale() === 'en' ? 'en' : 'ru';
        $suggestions = [];

        // Coordinates
        $coordinates = $this->parseCoordinates($q);
        if ($coordinates) {
            $suggestions[] = [
                'type' => 'coordinates',
                'lat'  => $coordinates['lat'],
                'lon'  => $coordinates['lon'],
            ];
        }

        // Places: the title in the request locale, the category and where the place is
        $placeContent = new PlacesContent(0);
        $placeContent->search($q, self::SUGGEST_PLACES);

        $topPlaceIds = array_slice($placeContent->placeIds, 0, self::SUGGEST_PLACES);

        $placesById = [];
        if (!empty($topPlaceIds)) {
            $rows = (new PlacesModel())
                ->select("places.id, places.slug, places.category,
                    location_localities.title_{$locale} as locality, location_regions.title_{$locale} as region")
                ->join('location_regions', 'location_regions.id = places.region_id', 'left')
                ->join('location_localities', 'location_localities.id = places.locality_id', 'left')
                ->whereIn('places.id', $topPlaceIds)
                ->asArray()
                ->findAll();

            $placesById = array_column($rows, null, 'id');
        }

        foreach ($topPlaceIds as $placeId) {
            // Soft-deleted places drop out here
            if (!isset($placesById[$placeId])) {
                continue;
            }

            $place = $placesById[$placeId];
            $title = $placeContent->title($placeId);

            $suggestions[] = [
                'type'     => 'place',
                'id'       => $placeId,
                'slug'     => $place['slug'] ?? null,
                'category' => $place['category'] ?? null,
                'title'    => $title,
                'address'  => SearchSuggestions::caption($title, [$place['locality'] ?? null, $place['region'] ?? null]),
            ];
        }

        // The site's own locations with places: their places listing
        $areas = SearchSuggestions::rankAreas($this->suggestAreas($q, $locale), $q, self::SUGGEST_AREAS);

        foreach ($areas as $area) {
            $suggestions[] = [
                'type'         => 'area',
                'locationType' => $area['type'],
                'id'           => $area['id'],
                'slug'         => $area['slug'],
                'title'        => $area['title'],
                'region'       => SearchSuggestions::caption($area['title'], [$area['region'] ?? null]),
                'placesCount'  => $area['placesCount'],
            ];
        }

        // Geocoder addresses: a point on the map, only when the site knows no such location (its
        // places answer better, and the geocoder's loose matches of a known name are noise). Its
        // failure (Nominatim's quota, a timeout) costs the addresses only, not the whole suggestion list
        try {
            $geoItems = $areas ? [] : (new Geocoder())->search($q);
        } catch (Throwable $e) {
            log_message('warning', 'Search::suggest geocoding failed: {message}', ['message' => $e->getMessage() ?: get_class($e)]);
            $geoItems = [];
        }

        foreach (array_slice($geoItems, 0, self::SUGGEST_ADDRESSES) as $location) {
            $title = $location['locality'] ?? '';

            $suggestions[] = [
                'type'      => 'location',
                'title'     => $title,
                'secondary' => SearchSuggestions::caption($title, [
                    $location['district'] ?? null,
                    $location['region'] ?? null,
                    $location['country'] ?? null,
                ]),
                'lat'       => $location['lat'],
                'lon'       => $location['lon'],
            ];
        }

        return $this->respond(['suggestions' => $suggestions]);
    }

    /**
     * Countries, regions, districts and localities named like the query that have places, a
     * few of each level, with the slug, the count and the region of a district or locality.
     *
     * @return array<int, array{type: string, id: int, slug: ?string, title: string, region: ?string, placesCount: int}>
     */
    private function suggestAreas(string $q, string $locale): array
    {
        $db     = Database::connect();
        $levels = [
            'country'  => ['location_countries', 'country_id', false],
            'region'   => ['location_regions', 'region_id', false],
            'district' => ['location_districts', 'district_id', true],
            'locality' => ['location_localities', 'locality_id', true],
        ];
        $result = [];

        foreach ($levels as $type => [$table, $placesColumn, $hasRegion]) {
            $query = $db->table("{$table} t")
                ->select(
                    "t.id, COALESCE(NULLIF(t.title_{$locale}, ''), t.title_ru, t.title_en) as title, ls.slug,
                    (SELECT COUNT(*) FROM places p WHERE p.{$placesColumn} = t.id AND p.deleted_at IS NULL) as placesCount"
                    . ($hasRegion ? ", COALESCE(NULLIF(r.title_{$locale}, ''), r.title_ru) as region" : ''),
                    false
                )
                ->join('location_slugs ls', "ls.type = '{$type}' AND ls.entity_id = t.id", 'left')
                ->groupStart()
                    ->like('t.title_ru', $q)
                    ->orLike('t.title_en', $q)
                ->groupEnd();

            if ($hasRegion) {
                $query->join('location_regions r', 'r.id = t.region_id', 'left');
            }

            $rows = $query
                ->having('placesCount >', 0)
                ->orderBy('placesCount', 'DESC')
                ->limit(self::SUGGEST_AREA_ROWS)
                ->get()
                ->getResult();

            foreach ($rows as $row) {
                $result[] = [
                    'type'        => $type,
                    'id'          => (int) $row->id,
                    'slug'        => $row->slug,
                    'title'       => (string) $row->title,
                    'region'      => $row->region ?? null,
                    'placesCount' => (int) $row->placesCount,
                ];
            }
        }

        return $result;
    }

    /**
     * Attempt to parse a query string as a lat/lon coordinate pair.
     *
     * Supports formats:
     *  - Decimal:         "51.4345, 58.1234" / "51.4345 58.1234"
     *  - DMS suffix:      "52°36'18"N 39°40'8"E"
     *  - DMS prefix:      "N52°36'18" E39°40'8""
     *  - DM suffix/prefix, decimal with N/S/E/W
     *
     * @param string $q
     * @return array{lat: float, lon: float}|null
     */
    private function parseCoordinates(string $q): ?array
    {
        $q = trim($q);

        // Simple decimal: "51.4345, 58.1234" or "51.4345 58.1234"
        if (preg_match('/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/', $q, $m)) {
            $lat = (float) $m[1];
            $lon = (float) $m[2];

            if ($lat >= -90 && $lat <= 90 && $lon >= -180 && $lon <= 180) {
                return ['lat' => $lat, 'lon' => $lon];
            }
        }

        // Normalize DMS/DM/D: replace degree/minute/second symbols with spaces.
        // Includes typographic variants: U+2018/2019 curly quotes, U+2032/2033 primes.
        $s = str_replace(['°', '′', '″', "'", '"', "\u{2018}", "\u{2019}", "\u{201C}", "\u{201D}"], ' ', $q);
        $s = preg_replace('/([NSEWnsew])/', ' $1 ', $s);
        $s = strtoupper(trim(preg_replace('/\s+/', ' ', $s)));

        $n = '(\d+(?:\.\d+)?)';

        // DMS hemisphere suffix: "52 36 18 N 39 40 8 E"
        if (preg_match("/^{$n} {$n} {$n} ([NS]) {$n} {$n} {$n} ([EW])$/u", $s, $m)) {
            return $this->buildCoord(
                (float) $m[1] + (float) $m[2] / 60 + (float) $m[3] / 3600, $m[4] === 'S',
                (float) $m[5] + (float) $m[6] / 60 + (float) $m[7] / 3600, $m[8] === 'W'
            );
        }

        // DMS hemisphere prefix: "N 52 36 18 E 39 40 8"
        if (preg_match("/^([NS]) {$n} {$n} {$n} ([EW]) {$n} {$n} {$n}$/u", $s, $m)) {
            return $this->buildCoord(
                (float) $m[2] + (float) $m[3] / 60 + (float) $m[4] / 3600, $m[1] === 'S',
                (float) $m[6] + (float) $m[7] / 60 + (float) $m[8] / 3600, $m[5] === 'W'
            );
        }

        // DM hemisphere suffix: "52 36.5 N 39 40.8 E"
        if (preg_match("/^{$n} {$n} ([NS]) {$n} {$n} ([EW])$/u", $s, $m)) {
            return $this->buildCoord(
                (float) $m[1] + (float) $m[2] / 60, $m[3] === 'S',
                (float) $m[4] + (float) $m[5] / 60, $m[6] === 'W'
            );
        }

        // DM hemisphere prefix: "N 52 36.5 E 39 40.8"
        if (preg_match("/^([NS]) {$n} {$n} ([EW]) {$n} {$n}$/u", $s, $m)) {
            return $this->buildCoord(
                (float) $m[2] + (float) $m[3] / 60, $m[1] === 'S',
                (float) $m[5] + (float) $m[6] / 60, $m[4] === 'W'
            );
        }

        // Decimal hemisphere suffix: "52.605 N 39.669 E"
        if (preg_match("/^{$n} ([NS]) {$n} ([EW])$/u", $s, $m)) {
            return $this->buildCoord((float) $m[1], $m[2] === 'S', (float) $m[3], $m[4] === 'W');
        }

        // Decimal hemisphere prefix: "N 52.605 E 39.669"
        if (preg_match("/^([NS]) {$n} ([EW]) {$n}$/u", $s, $m)) {
            return $this->buildCoord((float) $m[2], $m[1] === 'S', (float) $m[4], $m[3] === 'W');
        }

        return null;
    }

    /**
     * @param float $lat
     * @param bool  $latSouth
     * @param float $lon
     * @param bool  $lonWest
     * @return array{lat: float, lon: float}|null
     */
    private function buildCoord(float $lat, bool $latSouth, float $lon, bool $lonWest): ?array
    {
        if ($latSouth) {
            $lat = -$lat;
        }

        if ($lonWest) {
            $lon = -$lon;
        }

        if ($lat >= -90 && $lat <= 90 && $lon >= -180 && $lon <= 180) {
            return ['lat' => round($lat, 6), 'lon' => round($lon, 6)];
        }

        return null;
    }
}
