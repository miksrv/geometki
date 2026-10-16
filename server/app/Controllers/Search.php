<?php

namespace App\Controllers;

use App\Libraries\Geocoder;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SearchPlacesRanking;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Geocoder\Exception\Exception;

/**
 * Search controller
 *
 * Provides two endpoints:
 *  - GET /search        Full structured search across places, geocoder locations and coordinates.
 *  - GET /search/suggest  Lightweight autocomplete suggestions for the site header.
 *
 * @package App\Controllers
 */
class Search extends ResourceController
{
    /**
     * Full search across places, geocoder locations, and coordinate detection.
     *
     * GET /search?q=&type=all|location|coordinates|places&category=a,b&sort=&order=&lat=&lon=&limit=20&offset=0
     *
     * `places.categories` counts the found places per category before the category filter (the
     * client's facets); the sort runs over all found places in its natural direction unless
     * `order` is given, then the page is cut.
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
            $placeContent->search($q);

            $allPlaceIds = $placeContent->placeIds;

            $distanceSQL = '';
            if ($lat && $lon) {
                $distanceSQL = (new PlacesModel())->makeDistanceSQL($lat, $lon);
            }
            $coordinatesAvailable = $distanceSQL !== '';

            // One light query over every found place: the facets, the filter and the sort are
            // over the whole result, the page is cut after them
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

            $facets = SearchPlacesRanking::facets($rows);

            $categories = $category
                ? array_values(array_intersect(array_map('trim', explode(',', $category)), config('Categories')->names))
                : [];
            $rows = SearchPlacesRanking::filter($rows, $categories);

            if (!$sort) {
                $sort = $coordinatesAvailable ? 'distance' : 'relevance';
            }
            if ($sort === 'distance' && !$coordinatesAvailable) {
                $sort = 'relevance';
            }
            $rows = SearchPlacesRanking::sort($rows, $sort, $order);

            $totalCount = count($rows);
            $pagedIds   = array_column(array_slice($rows, $offset, $limit), 'id');

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

            $result['places'] = [
                'items'      => $formattedPlaces,
                'count'      => $totalCount,
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
     * Lightweight autocomplete suggestions for the site header.
     *
     * Returns up to 5 suggestions total: up to 2 places (id+title only),
     * up to 2 geocoder locations, and 1 coordinates entry when the query
     * parses as a coordinate pair.
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

        // Places — only id and title, no full formatting
        $placeContent = new PlacesContent(0);
        $placeContent->search($q);

        $topPlaceIds = array_slice($placeContent->placeIds, 0, 2);

        $placesById = [];
        if (!empty($topPlaceIds)) {
            $placesModel = new PlacesModel();
            $placesById  = array_column(
                $placesModel->select('id, slug, category')->whereIn('id', $topPlaceIds)->findAll(),
                null,
                'id'
            );
        }

        foreach ($topPlaceIds as $placeId) {
            $suggestions[] = [
                'type'     => 'place',
                'id'       => $placeId,
                'slug'     => $placesById[$placeId]->slug ?? null,
                'category' => $placesById[$placeId]->category ?? null,
                'title'    => $placeContent->title($placeId),
            ];
        }

        // Geocoder locations — up to 2
        $geocoder  = new Geocoder();
        $geoItems  = $geocoder->search($q);
        $geoSlice  = array_slice($geoItems, 0, 2);

        foreach ($geoSlice as $location) {
            $suggestions[] = [
                'type'  => 'location',
                'title' => $location['locality'] ?? '',
                'lat'   => $location['lat'],
                'lon'   => $location['lon'],
            ];
        }

        // Cap total at 5
        $suggestions = array_slice($suggestions, 0, 5);

        return $this->respond(['suggestions' => $suggestions]);
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
