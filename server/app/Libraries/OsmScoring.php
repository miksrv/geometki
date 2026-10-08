<?php

namespace App\Libraries;

use Config\OsmCandidates;

/**
 * Scoring of OSM objects as candidates for new places. Pure logic: no network and no database,
 * so the same code scores freshly collected objects and recalculates the stored ones.
 *
 * The score comes from the OSM tags and the enrichment (Wikipedia, popularity).
 *
 * @package App\Libraries
 */
class OsmScoring
{
    public const TIER_KNOWN   = 'known';
    public const TIER_EXPLORE = 'explore';
    public const TIER_OTHER   = 'other';

    private OsmCandidates $config;

    /** osm_tag => [category, title ru, title en, base score, mode] */
    private array $typesByTag = [];

    public function __construct(?OsmCandidates $config = null)
    {
        $this->config = $config ?? config('OsmCandidates');

        foreach ($this->config->types as $key => $values) {
            foreach ($values as $value => $type) {
                $this->typesByTag["{$key}={$value}"] ??= $type;
            }
        }

        $this->typesByTag += $this->config->extraTypes;

        // Objects found only in Wikidata are typed by their class: "wd:class=Q35509"
        foreach ($this->config->wikidataTypes + $this->config->heritageTypes as $class => $type) {
            $this->typesByTag["wd:class={$class}"] = $type;
        }
    }

    /**
     * Type of an object by its tags
     *
     * @return array{0: string, 1: string, 2: string, 3: string, 4: int, 5: ?string}|null
     *         osm_tag, category, title ru, title en, base score, mode
     */
    public function detectType(array $tags): ?array
    {
        foreach ($this->config->types as $key => $values) {
            if (isset($tags[$key]) && isset($values[$tags[$key]])) {
                return ["{$key}={$tags[$key]}", ...$values[$tags[$key]]];
            }
        }

        foreach ($this->config->extraTypes as $tag => $type) {
            [$key, $value] = explode('=', $tag, 2);

            if (($tags[$key] ?? null) === $value) {
                return [$tag, ...$type];
            }
        }

        $class = $tags['wd:class'] ?? null;

        if ($class !== null && isset($this->typesByTag["wd:class={$class}"])) {
            return ["wd:class={$class}", ...$this->typesByTag["wd:class={$class}"]];
        }

        return null;
    }

    /**
     * Localized title of a type, e.g. "Вершина" for "natural=peak"
     */
    public function typeTitle(string $osmTag, string $locale): string
    {
        $type = $this->typesByTag[$osmTag] ?? null;

        if (!$type) {
            return $osmTag;
        }

        return $locale === 'ru' ? $type[1] : $type[2];
    }

    /**
     * Scores an object by its OSM tags and enrichment
     *
     * @param string   $osmType    node, way or relation
     * @param array    $tags       OSM tags
     * @param int|null $size       bounding box diagonal in meters, null for points
     * @param array    $enrichment wikiSource ('osm'|'nearby'|'wikidata'|null), wikiTitle, wikiDistance, sitelinks,
     *                             heritage (cultural heritage code), photo (has a Commons photo)
     *
     * @return array|string the result, or the reason why the object is not a candidate
     */
    public function evaluate(string $osmType, array $tags, ?int $size = null, array $enrichment = []): array|string
    {
        $type = $this->detectType($tags);

        if (!$type) {
            return 'unknown type';
        }

        [$osmTag, $category, , , $baseScore, $mode] = $type;

        $points      = $this->config->points;
        $name        = $this->name($tags);
        $hasOsmWiki  = isset($tags['wikipedia']) || isset($tags['wikidata']) || isset($tags['subject:wikidata']);
        $isProtected = isset($tags['heritage']) || isset($tags['heritage:operator']) || isset($tags['ref:okn'])
            || ($tags['denotation'] ?? null) === 'natural_monument'
            || isset($tags['protect_class']) || ($tags['leisure'] ?? null) === 'nature_reserve'
            || !empty($enrichment['heritage']);

        if ($osmTag === 'natural=water' && in_array($tags['water'] ?? null, $this->config->notLakes, true)) {
            return 'not a lake';
        }

        if ($mode === 'name' && !$name) {
            return "no name: {$osmTag}";
        }

        if ($mode === 'gated' && !$hasOsmWiki && !$isProtected) {
            return "not notable: {$osmTag}";
        }

        if (in_array($tags['memorial'] ?? null, $this->config->minorMemorials, true)) {
            return "minor memorial: {$tags['memorial']}";
        }

        $score     = $baseScore;
        $breakdown = [['code' => 'type', 'points' => $baseScore, 'value' => $osmTag]];

        $add = static function (string $code, int $value, mixed $detail = null, array $extra = []) use (&$score, &$breakdown) {
            $score      += $value;
            $breakdown[] = ['code' => $code, 'points' => $value] + ($detail !== null ? ['value' => $detail] : []) + $extra;
        };

        if ($hasOsmWiki) {
            $add('wiki', $points['wiki']);
        } elseif (in_array($enrichment['wikiSource'] ?? null, ['nearby', 'wikidata'], true) && !empty($enrichment['wikiTitle'])) {
            $add('nearbyWiki', $points['nearbyWiki'], $enrichment['wikiTitle'], ['distance' => (int) ($enrichment['wikiDistance'] ?? 0)]);
        }

        $sitelinks = (int) ($enrichment['sitelinks'] ?? 0);

        if ($sitelinks > 0) {
            $add('sitelinks', $this->thresholdPoints($this->config->sitelinksPoints, $sitelinks), $sitelinks);
        }

        if ($isProtected) {
            $add('protected', $points['protected']);
        }

        if (isset($tags['image']) || isset($tags['wikimedia_commons']) || !empty($enrichment['photo'])) {
            $add('photo', $points['photo']);
        }

        if (isset($tags['description']) || isset($tags['description:ru'])) {
            $add('description', $points['description']);
        }

        if (isset($tags['website']) || isset($tags['contact:website']) || isset($tags['url'])) {
            $add('website', $points['website']);
        }

        $nameLanguages = count(array_filter(array_keys($tags), static fn ($key) => str_starts_with($key, 'name:')));

        if ($nameLanguages >= 2) {
            $add('names', $points['names'], $nameLanguages);
        }

        if ($osmType !== 'node') {
            $add('contour', $points['contour']);
        }

        if (($tags['salt'] ?? null) === 'yes') {
            $add('salt', $points['salt']);
        }

        if ($osmTag === 'natural=water' && $size) {
            $sizePoints = $this->thresholdPoints($this->config->lakeSizePoints, $size);

            if ($sizePoints) {
                $add('lakeSize', $sizePoints, $size);
            }
        }

        if (isset($tags['length']) || isset($tags['depth'])) {
            $add('dimensions', $points['dimensions']);
        }

        if (!$name) {
            $add('noName', $points['noName']);
        }

        if (in_array($tags['access'] ?? null, ['private', 'no'], true)) {
            $add('private', $points['private']);
        }

        return [
            'osmTag'     => $osmTag,
            'category'   => $category,
            'name'       => $name,
            'score'      => $score,
            'breakdown'  => $breakdown,
            'explorable' => $this->isExplorable($osmTag),
            'wikipedia'  => $tags['wikipedia'] ?? null,
            'wikidata'   => $tags['wikidata'] ?? $tags['subject:wikidata'] ?? null,
        ];
    }

    /**
     * Whether the type is worth a visit even without information, see `exploreCategories`
     */
    public function isExplorable(string $osmTag): bool
    {
        $type = $this->typesByTag[$osmTag] ?? null;

        return $type && $type[3] >= 1 && in_array($type[0], $this->config->exploreCategories, true);
    }

    /**
     * known: enough information for a card; explore: an interesting type with little information
     * (may have no name, then it is never "known"); other: the rest
     */
    public function tier(int $score, ?string $name, bool $explorable): string
    {
        if ($score >= $this->config->knownMinScore && $name) {
            return self::TIER_KNOWN;
        }

        if ($explorable && $score >= 0) {
            return self::TIER_EXPLORE;
        }

        return self::TIER_OTHER;
    }

    public function name(array $tags): ?string
    {
        $name = $tags['name'] ?? $tags['name:ru'] ?? $tags['name:en'] ?? null;

        return $name !== null && trim($name) !== '' ? trim($name) : null;
    }

    /**
     * Share of meaningful word stems of the shorter title found in the longer one, 0-100
     */
    public function titleSimilarity(string $a, string $b): float
    {
        $a = $this->stems($a);
        $b = $this->stems($b);

        if (!$a || !$b) {
            return 0;
        }

        $common  = count(array_intersect($a, $b));
        $shorter = min(count($a), count($b));

        // A single shared word ("Оренбургский ...") is not enough unless it is the whole shorter title
        if ($common === 1 && $shorter > 1) {
            return round(100 / $shorter / 2, 1);
        }

        return round($common / $shorter * 100, 1);
    }

    /**
     * Nearest settlement counted from its edge: the radius is estimated from the population,
     * so a place in a big city is "in the city", not "8 km from a hamlet" next to its centre
     *
     * @param array $settlements list of [name, type, population, lat, lon]
     * @return array{name: string, type: string, distance: int}|null distance 0 means inside
     */
    public function nearestSettlement(float $lat, float $lon, array $settlements): ?array
    {
        $best = null;

        foreach ($settlements as $settlement) {
            $radius = !empty($settlement['population'])
                ? min(20000, max(200, 15 * sqrt((float) $settlement['population'])))
                : ($this->config->settlementRadius[$settlement['type']] ?? 500);

            $distance = max(0, self::distance($lat, $lon, $settlement['lat'], $settlement['lon']) - $radius);

            if (!$best || $distance < $best['distance']) {
                $best = ['name' => $settlement['name'], 'type' => $settlement['type'], 'distance' => (int) round($distance)];
            }
        }

        return $best;
    }

    /**
     * Finds the Wikipedia article of a named object among the articles nearby. Articles about
     * settlements, streets and institutions are skipped: a lake named after a village must not
     * get the village's article
     *
     * @param array $articles    geosearch results: [pageid, title, lat, lon]
     * @param array $settlements settlement names in the area
     * @return array|null the article with `distance`
     */
    public function matchNearbyArticle(string $name, float $lat, float $lon, array $articles, array $settlements): ?array
    {
        foreach ($articles as $article) {
            if (preg_match($this->config->notObjectArticles, $article['title'])) {
                continue;
            }

            $distance = self::distance($lat, $lon, (float) $article['lat'], (float) $article['lon']);

            if ($distance > $this->config->wikiSearchRadius || $this->titleSimilarity($name, $article['title']) < 100) {
                continue;
            }

            $isSettlement = false;

            foreach ($settlements as $settlement) {
                if (
                    $this->titleSimilarity($article['title'], $settlement) >= 100 &&
                    !preg_match($this->config->naturalArticles, $article['title'])
                ) {
                    $isSettlement = true;
                    break;
                }
            }

            if (!$isSettlement) {
                return $article + ['distance' => (int) round($distance)];
            }
        }

        return null;
    }

    /**
     * Whether an existing place is the same object: a similar title nearby, or the same category very close
     *
     * @return float|null title similarity when it is a duplicate, null otherwise
     */
    public function duplicateOf(?string $name, string $category, float $lat, float $lon, array $place): ?float
    {
        $distance = self::distance($lat, $lon, (float) $place['lat'], (float) $place['lon']);

        if ($distance > $this->config->duplicateRadius) {
            return null;
        }

        $similarity = 0;

        foreach ($place['titles'] ?? [] as $title) {
            $similarity = max($similarity, $this->titleSimilarity((string) $name, (string) $title));
        }

        if ($similarity >= 50 || ($place['category'] === $category && $distance <= $this->config->sameCategoryRadius)) {
            return $similarity;
        }

        return null;
    }

    /**
     * Whether a place just created by a user may take the candidate. Close to it, the usual
     * duplicate rules apply (see duplicateOf). Further, up to `linkRadius`, the user may have
     * moved the marker to the real spot, so only a similar title counts
     *
     * @param array $place [category, lat, lon, titles]
     */
    public function isNewPlaceOf(?string $name, string $category, float $lat, float $lon, array $place): bool
    {
        $distance = self::distance($lat, $lon, (float) $place['lat'], (float) $place['lon']);

        if ($distance > $this->config->linkRadius) {
            return false;
        }

        if ($this->duplicateOf($name, $category, $lat, $lon, $place) !== null) {
            return true;
        }

        $similarity = 0;

        foreach ($place['titles'] ?? [] as $title) {
            $similarity = max($similarity, $this->titleSimilarity((string) $name, (string) $title));
        }

        return $similarity >= 50;
    }

    /**
     * Places bucketed by cells not smaller than `duplicateRadius`: a candidate is compared only
     * with the places of its own and the 8 neighbouring cells, not with every place of the area
     *
     * @param array<int, array> $places [id, category, lat, lon, titles]
     * @param float             $latitude a latitude of the area, for the cell width in degrees
     * @return array{cellLat: float, cellLon: float, cells: array<string, array<int, array>>}
     */
    public function placesGrid(array $places, float $latitude): array
    {
        $cellLat = $this->config->duplicateRadius / 111000;
        // Meridians converge: the further north, the more degrees of longitude make the radius
        $cellLon = $cellLat / max(0.05, cos(deg2rad(min(89.0, abs($latitude) + 1))));
        $cells   = [];

        foreach ($places as $place) {
            $key            = (int) floor((float) $place['lat'] / $cellLat) . ':' . (int) floor((float) $place['lon'] / $cellLon);
            $cells[$key][] = $place;
        }

        return ['cellLat' => $cellLat, 'cellLon' => $cellLon, 'cells' => $cells];
    }

    /**
     * The places of the grid that may be within `duplicateRadius` of the point
     *
     * @return array<int, array>
     */
    public function placesNear(array $grid, float $lat, float $lon): array
    {
        $row    = (int) floor($lat / $grid['cellLat']);
        $column = (int) floor($lon / $grid['cellLon']);
        $places = [];

        for ($dRow = -1; $dRow <= 1; $dRow++) {
            for ($dColumn = -1; $dColumn <= 1; $dColumn++) {
                array_push($places, ...($grid['cells'][($row + $dRow) . ':' . ($column + $dColumn)] ?? []));
            }
        }

        return $places;
    }

    public static function distance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $rad  = M_PI / 180;
        $dLat = ($lat2 - $lat1) * $rad;
        $dLon = ($lon2 - $lon1) * $rad;
        $a    = sin($dLat / 2) ** 2 + cos($lat1 * $rad) * cos($lat2 * $rad) * sin($dLon / 2) ** 2;

        return 6371000 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function stems(string $text): array
    {
        // Our titles often end with the city in brackets: "Ротонда (Оренбург)"
        $text  = preg_replace('/\([^)]*\)/u', ' ', $text);
        $text  = str_replace('ё', 'е', mb_strtolower($text));
        $words = preg_split('/[^\p{L}\p{N}]+/u', $text, -1, PREG_SPLIT_NO_EMPTY);
        $words = array_filter($words, fn ($word) => !in_array($word, $this->config->titleStopWords, true) && mb_strlen($word) > 1);

        // Crude stemming: the first 5 letters are enough to match word forms ("Петру" / "Петра")
        return array_values(array_unique(array_map(static fn ($word) => mb_substr($word, 0, 5), $words)));
    }

    /**
     * @param array<int, int> $thresholds [min value => points], sorted from the biggest
     */
    private function thresholdPoints(array $thresholds, int $value): int
    {
        krsort($thresholds);

        foreach ($thresholds as $min => $points) {
            if ($value >= $min) {
                return $points;
            }
        }

        return 0;
    }
}
