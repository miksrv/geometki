<?php

namespace App\Libraries;

use Config\Database;
use Config\Game;
use GuzzleHttp\Client;
use RuntimeException;

/**
 * The outlines of large places from OpenStreetMap (`places_outlines`): a lake, a park, a kremlin.
 * "Near the place" is near its outline too (GameLibrary::isNear()), so a lake is confirmed from
 * its shore, not only within the radius of its point.
 *
 * An outline is taken only when it fits the category (`Game::$outlineTags`), contains the point
 * of the place or lies near it (`$outlineSearch`), is not too large (`$outlineMaxSize`), and its
 * name is like the title of the place (sameName()): an unnamed wood or the whole reserve around
 * a gorge never counts. Looked up by `php spark places:outlines` only, never from a request.
 *
 * The geometry is `{rings: [[[lat, lon], ...], ...], lines: [...]}`: the rings of an area
 * (outer and inner, as OSM gives them: one ring may be split into several lines) and the open
 * lines of a linear object (a cliff, a ridge).
 */
class PlaceOutlines
{
    /** The words of titles that never make two names the same */
    private const GENERIC = [
        'озеро', 'озера', 'пруд', 'пруды', 'водохранилище', 'река', 'реки', 'ручей', 'родник', 'источник',
        'источники', 'залив', 'бухта', 'ущелье', 'каньон', 'гора', 'горы', 'хребет', 'скала', 'скалы', 'пещера',
        'роща', 'парк', 'усадьба', 'усадьбы', 'музей', 'дворец', 'замок', 'крепость', 'кремль', 'башня', 'завод',
        'фабрика', 'карьер', 'шахта', 'рудник', 'штольня', 'штольни', 'остров', 'долина', 'водопад',
        'заповедник', 'заказник', 'национальный', 'природный', 'памятник', 'комплекс', 'территория', 'урочище',
        'монастырь', 'старый', 'старая', 'старое', 'новый', 'новая', 'новое', 'большой', 'большая', 'большое',
        'малый', 'малая', 'малое', 'имени', 'museum', 'lake', 'pond', 'reservoir', 'river',
        'spring', 'park', 'garden', 'manor', 'estate', 'palace', 'castle', 'fortress', 'fort', 'tower', 'factory',
        'plant', 'quarry', 'mine', 'island', 'cape', 'valley', 'mountain', 'mount', 'ridge', 'national',
        'nature', 'reserve', 'monastery', 'state', 'central',
    ];

    /** The OSM tags of names compared with the titles */
    private const NAME_TAGS = ['name', 'name:ru', 'name:en', 'official_name', 'alt_name', 'old_name', 'short_name', 'loc_name'];

    /** Points of a geometry kept at most: a reservoir needs no more to be told from the shore */
    private const MAX_POINTS = 4000;

    private Game $config;
    private ?OsmSourcesClient $client;

    public function __construct(?Game $config = null, ?OsmSourcesClient $client = null)
    {
        $this->config = $config ?? config('Game');
        $this->client = $client;
    }

    /** Whether places of the category get an outline */
    public function wanted(?string $category): bool
    {
        return isset($this->config->outlineTags[$category ?? '']);
    }

    /**
     * Looks the outline of a place up in OSM
     *
     * @param object   $place  `lat`, `lon`, `category`
     * @param string[] $titles the titles of the place in every locale
     *
     * @return array{source: string, name: string, size: int, geometry: array}|null null when none fits
     * @throws RuntimeException when Overpass fails
     */
    public function lookup(object $place, array $titles): ?array
    {
        $tags = $this->config->outlineTags[$place->category ?? ''] ?? null;

        if (!$tags) {
            return null;
        }

        $lat    = (float) $place->lat;
        $lon    = (float) $place->lon;
        $around = $this->config->outlineSearch;

        // The areas that contain the point, a separator, then the objects around it: tags and boxes only
        $elements = $this->client()->overpass(
            "[out:json][timeout:60];is_in({$lat},{$lon})->.a;(way(pivot.a);rel(pivot.a);)->.inside;.inside out tags bb;"
            . "make sep;out;(way(around:{$around},{$lat},{$lon});rel(around:{$around},{$lat},{$lon}););out tags bb;"
        );

        $best = self::choose($elements, $tags, $titles, $lat, $lon, $this->config->outlineMaxSize);

        if (!$best) {
            return null;
        }

        $kind     = $best['type'] === 'relation' ? 'rel' : 'way';
        $full     = $this->client()->overpass("[out:json][timeout:120];{$kind}({$best['id']});out geom;");
        $geometry = self::geometry($full[0] ?? []);

        if (!$geometry['rings'] && !$geometry['lines']) {
            return null;
        }

        $geometry = self::simplifyAll($geometry, $best['size']);

        // The box was near, the object itself may not be
        if (self::distanceTo($geometry, $lat, $lon) > $around) {
            return null;
        }

        return [
            'source'   => $best['type'] . '/' . $best['id'],
            'name'     => $best['name'],
            'size'     => $best['size'],
            'geometry' => $geometry,
        ];
    }

    /**
     * Saves what lookup() found (null: checked, nothing fits)
     */
    public static function save(string $placeId, ?array $outline): void
    {
        Database::connect()->table('places_outlines')->replace([
            'place_id'   => $placeId,
            'source'     => $outline['source'] ?? null,
            'name'       => isset($outline['name']) ? mb_substr($outline['name'], 0, 255) : null,
            'size'       => $outline['size'] ?? null,
            'geometry'   => $outline ? json_encode($outline['geometry']) : null,
            'checked_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /** Forgets the outline of a place that moved or changed its category: it is looked up again */
    public static function forget(string $placeId): void
    {
        Database::connect()->table('places_outlines')->where('place_id', $placeId)->delete();
    }

    /**
     * The best outline of the Overpass answer of lookup(): of those that fit and are named like
     * the place, the smallest one containing the point, otherwise the nearest one
     *
     * @param array<int, array>     $elements `out tags bb` elements, a `sep` between the containing and the near ones
     * @param array<string, string> $tags     key => regex of the value
     * @param string[]              $titles
     *
     * @return array{type: string, id: int, name: string, size: int}|null
     */
    public static function choose(array $elements, array $tags, array $titles, float $lat, float $lon, int $maxSize): ?array
    {
        $best   = null;
        $inside = true;

        foreach ($elements as $element) {
            if (($element['type'] ?? '') === 'sep') {
                $inside = false;
                continue;
            }

            $bounds  = $element['bounds'] ?? null;
            $osmTags = $element['tags'] ?? [];

            if (!$bounds || !self::fits($tags, $osmTags) || !self::sameName($titles, $osmTags)) {
                continue;
            }

            $size = GameLibrary::distance($bounds['minlat'], $bounds['minlon'], $bounds['maxlat'], $bounds['maxlon']);

            if ($size > $maxSize) {
                continue;
            }

            // Containing ones first, the smallest; then the nearest box
            $rank = $inside ? $size : PHP_INT_MAX / 2 + self::boxDistance($bounds, $lat, $lon);

            if ($best === null || $rank < $best['rank']) {
                $best = [
                    'rank' => $rank,
                    'type' => $element['type'],
                    'id'   => (int) $element['id'],
                    'name' => self::nameOf($osmTags),
                    'size' => $size,
                ];
            }
        }

        if ($best) {
            unset($best['rank']);
        }

        return $best;
    }

    /**
     * @param array<string, string> $tags    key => regex of the value
     * @param array<string, string> $osmTags
     */
    public static function fits(array $tags, array $osmTags): bool
    {
        foreach ($tags as $key => $pattern) {
            if (isset($osmTags[$key]) && preg_match('/^(?:' . $pattern . ')$/u', $osmTags[$key])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Whether an OSM object is named like the place: a word of its name and of a title share
     * their first five letters (Останкино — Останкинский дворец, Мёртвое — Озеро Мертвое),
     * generic words (озеро, парк, усадьба) and words shorter than four letters aside
     *
     * @param string[]              $titles
     * @param array<string, string> $osmTags
     */
    public static function sameName(array $titles, array $osmTags): bool
    {
        $names = [];

        foreach (self::NAME_TAGS as $key) {
            if (!empty($osmTags[$key])) {
                $names[] = $osmTags[$key];
            }
        }

        if (!$names) {
            return false;
        }

        $ours = self::stems(implode(' ', $titles));

        return $ours && array_intersect($ours, self::stems(implode(' ', $names)));
    }

    /** @return string[] the five-letter stems of the meaningful words of a text */
    public static function stems(string $text): array
    {
        $text  = str_replace('ё', 'е', mb_strtolower($text));
        $stems = [];

        foreach (preg_split('/[^\p{L}\p{N}]+/u', $text, -1, PREG_SPLIT_NO_EMPTY) as $word) {
            if (mb_strlen($word) >= 4 && !in_array($word, self::GENERIC, true)) {
                $stems[mb_substr($word, 0, 5)] = true;
            }
        }

        return array_keys($stems);
    }

    /**
     * The geometry of an `out geom` element
     *
     * @return array{rings: array, lines: array}
     */
    public static function geometry(array $element): array
    {
        $rings = [];
        $lines = [];
        $line  = static fn (array $points) => array_map(
            static fn (array $point) => [round((float) $point['lat'], 6), round((float) $point['lon'], 6)],
            $points
        );

        if (($element['type'] ?? '') === 'way' && !empty($element['geometry'])) {
            $points = $line($element['geometry']);

            // A closed way is an area, an open one a line (a cliff)
            if (count($points) >= 4 && $points[0] === $points[count($points) - 1]) {
                $rings[] = $points;
            } else {
                $lines[] = $points;
            }
        }

        if (($element['type'] ?? '') === 'relation') {
            $area = in_array($element['tags']['type'] ?? '', ['multipolygon', 'boundary'], true);

            foreach ($element['members'] ?? [] as $member) {
                if (($member['type'] ?? '') !== 'way' || empty($member['geometry'])) {
                    continue;
                }

                if ($area) {
                    $rings[] = $line($member['geometry']);
                } else {
                    $lines[] = $line($member['geometry']);
                }
            }
        }

        return ['rings' => $rings, 'lines' => $lines];
    }

    /**
     * Metres from a point to an outline: 0 inside its rings, otherwise to the nearest edge
     *
     * @param array{rings: array, lines: array} $geometry
     */
    public static function distanceTo(array $geometry, float $lat, float $lon): int
    {
        if (self::contains($geometry['rings'] ?? [], $lat, $lon)) {
            return 0;
        }

        // A local plane around the point: metres along the parallel and the meridian
        $kx   = 111320 * cos(deg2rad($lat));
        $ky   = 110574;
        $best = INF;

        foreach (array_merge($geometry['rings'] ?? [], $geometry['lines'] ?? []) as $points) {
            $count = count($points);

            for ($i = 0; $i < $count; $i++) {
                $ax = ($points[$i][1] - $lon) * $kx;
                $ay = ($points[$i][0] - $lat) * $ky;

                if ($count === 1) {
                    $best = min($best, hypot($ax, $ay));
                    break;
                }

                if ($i === $count - 1) {
                    break;
                }

                $bx = ($points[$i + 1][1] - $lon) * $kx;
                $by = ($points[$i + 1][0] - $lat) * $ky;

                $best = min($best, self::segmentDistance($ax, $ay, $bx, $by));
            }
        }

        return is_finite($best) ? (int) round($best) : PHP_INT_MAX;
    }

    /**
     * Whether a point is inside the rings, by the even-odd rule: an island in a lake is outside.
     * The edges may come in any order and split into several lines
     */
    public static function contains(array $rings, float $lat, float $lon): bool
    {
        $inside = false;

        foreach ($rings as $points) {
            $count = count($points);

            for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
                // An unclosed piece of a ring: its own ends are no edge
                if ($i === 0 && $points[0] !== $points[$count - 1]) {
                    continue;
                }

                [$latI, $lonI] = $points[$i];
                [$latJ, $lonJ] = $points[$j];

                if (($latI > $lat) !== ($latJ > $lat)
                    && $lon < ($lonJ - $lonI) * ($lat - $latI) / ($latJ - $latI) + $lonI) {
                    $inside = !$inside;
                }
            }
        }

        return $inside;
    }

    /**
     * Simplifies every ring and line (Douglas–Peucker), coarser for larger objects, so the
     * whole geometry keeps at most MAX_POINTS points
     *
     * @param array{rings: array, lines: array} $geometry
     * @param int                               $size the diagonal of its box, metres
     *
     * @return array{rings: array, lines: array}
     */
    public static function simplifyAll(array $geometry, int $size): array
    {
        $tolerance = max(5.0, $size / 2000);
        $previous  = PHP_INT_MAX;

        do {
            $result = ['rings' => [], 'lines' => []];
            $total  = 0;

            foreach (['rings', 'lines'] as $kind) {
                foreach ($geometry[$kind] as $points) {
                    $points = self::simplify($points, $tolerance);
                    $total += count($points);
                    $result[$kind][] = $points;
                }
            }

            $tolerance *= 2;
            // Every ring and line keeps its ends: thousands of them never get under the limit
            $shrunk   = $total < $previous;
            $previous = $total;
        } while ($total > self::MAX_POINTS && $shrunk);

        return $result;
    }

    /**
     * Douglas–Peucker on [lat, lon] points, the tolerance in metres; the ends are always kept
     *
     * @param array<int, array{0: float, 1: float}> $points
     */
    public static function simplify(array $points, float $tolerance): array
    {
        $count = count($points);

        if ($count < 3) {
            return $points;
        }

        $kx   = 111320 * cos(deg2rad($points[0][0]));
        $ky   = 110574;
        $keep = [0 => true, $count - 1 => true];
        $todo = [[0, $count - 1]];

        while ($todo) {
            [$from, $to] = array_pop($todo);
            $far         = -1.0;
            $index       = null;

            for ($i = $from + 1; $i < $to; $i++) {
                $distance = self::segmentDistance(
                    ($points[$from][1] - $points[$i][1]) * $kx,
                    ($points[$from][0] - $points[$i][0]) * $ky,
                    ($points[$to][1] - $points[$i][1]) * $kx,
                    ($points[$to][0] - $points[$i][0]) * $ky
                );

                if ($distance > $far) {
                    $far   = $distance;
                    $index = $i;
                }
            }

            if ($index !== null && $far > $tolerance) {
                $keep[$index] = true;
                $todo[]       = [$from, $index];
                $todo[]       = [$index, $to];
            }
        }

        ksort($keep);

        return array_values(array_intersect_key($points, $keep));
    }

    /** The distance from the origin to the segment a–b on a plane */
    private static function segmentDistance(float $ax, float $ay, float $bx, float $by): float
    {
        $dx     = $bx - $ax;
        $dy     = $by - $ay;
        $length = $dx * $dx + $dy * $dy;
        $t      = $length > 0 ? max(0, min(1, -($ax * $dx + $ay * $dy) / $length)) : 0;

        return hypot($ax + $t * $dx, $ay + $t * $dy);
    }

    private static function boxDistance(array $bounds, float $lat, float $lon): int
    {
        return GameLibrary::distance(
            $lat,
            $lon,
            min(max($lat, $bounds['minlat']), $bounds['maxlat']),
            min(max($lon, $bounds['minlon']), $bounds['maxlon'])
        );
    }

    /** @param array<string, string> $osmTags */
    private static function nameOf(array $osmTags): string
    {
        return (string) ($osmTags['name:ru'] ?? $osmTags['name'] ?? $osmTags['name:en'] ?? '');
    }

    private function client(): OsmSourcesClient
    {
        // `is_in` of a large area waits in the Overpass queue longer than a tile does
        return $this->client ??= new OsmSourcesClient(null, new Client([
            'timeout' => 90,
            'headers' => ['User-Agent' => config('OsmCandidates')->userAgent],
        ]));
    }
}
