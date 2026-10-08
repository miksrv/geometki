<?php

namespace App\Libraries;

use App\Entities\OsmTileEntity;
use App\Models\OsmCandidatesModel;
use CodeIgniter\I18n\Time;
use Config\OsmCandidates;

/**
 * Collects the candidates of a tile: asks Overpass and Wikidata, glues the objects that are the same
 * (by the OSM wikidata tag, or by a similar title nearby), finds the missing Wikipedia articles,
 * the popularity and the Commons photos, scores the objects and upserts the candidates.
 * Links to places and rejections survive a re-collection, objects that disappeared
 * from the sources become "gone".
 *
 * Runs only in the background (`php spark osm:collect`), never in a user request.
 *
 * @package App\Libraries
 */
class OsmCollector
{
    /** Margin around a tile for the Wikipedia articles, degrees (~1 km) */
    private const ARTICLES_MARGIN = 0.01;

    private OsmCandidates $config;
    private OsmScoring $scoring;
    private OsmTiles $tiles;
    private OsmSourcesClient $client;
    private OsmCandidatesModel $model;

    /** Why objects were skipped during the last collection: reason => count */
    public array $skipped = [];

    /** Seconds spent on each step of the last collection: step => seconds */
    public array $timings = [];

    /** Wikidata items of the last collection: glued to OSM objects, and added as new objects */
    public int $glued = 0;
    public int $wikidataOnly = 0;

    public function __construct(
        ?OsmCandidates $config = null,
        ?OsmSourcesClient $client = null,
        ?OsmCandidatesModel $model = null
    ) {
        $this->config  = $config ?? config('OsmCandidates');
        $this->scoring = new OsmScoring($this->config);
        $this->tiles   = new OsmTiles($this->config);
        $this->client  = $client ?? new OsmSourcesClient($this->config);
        $this->model   = $model ?? new OsmCandidatesModel();
    }

    /**
     * Any failing source fails the whole tile: it is retried later (see OsmTilesModel::markFailed).
     * Saving a half-enriched tile would drop the stored articles, photos and Wikidata-only objects.
     *
     * @return int number of candidates in the tile
     * @throws \RuntimeException when a source fails
     */
    public function collectTile(OsmTileEntity $tile): int
    {
        $this->skipped      = [];
        $this->timings      = [];
        $this->glued        = 0;
        $this->wikidataOnly = 0;

        $bounds   = $this->tiles->tileBounds($tile->tile_lat, $tile->tile_lon);
        $elements = $this->timed('overpass', fn () => $this->client->fetchElements($bounds));

        [$objects, $settlements] = $this->parseElements($elements, $tile);
        $settlementNames         = array_column($settlements, 'name');

        // Closures by reference: the steps change the objects (arrow functions would copy them)
        $this->timed('wikipedia', function () use (&$objects, $bounds, $settlementNames) {
            $this->findNearbyArticles($objects, $bounds, $settlementNames);
        });
        $this->timed('wikidata', function () use (&$objects, $bounds, $tile, $settlementNames) {
            $this->addWikidata($objects, $bounds, $tile, $settlementNames);
        });
        $this->timed('popularity', function () use (&$objects) {
            $this->findPopularity($objects);
        });
        $this->timed('commons', function () use (&$objects) {
            $this->findPhotos($objects);
        });

        foreach ($objects as &$object) {
            $object['result']     = $this->scoring->evaluate($object['type'] ?? 'node', $object['tags'], $object['size'], $object['enrichment']);
            $object['settlement'] = $this->scoring->nearestSettlement($object['lat'], $object['lon'], $settlements);
        }

        unset($object);

        return $this->save($objects, $tile);
    }

    /**
     * Recalculates the scores of all stored candidates from their tags, e.g. after changing the rules
     *
     * @return array{updated: int, gone: int}
     */
    public function rescoreAll(): array
    {
        $updated = 0;
        $gone    = 0;
        $lastId  = '';

        do {
            $rows = $this->model->builder()
                ->where('id >', $lastId)
                ->whereIn('status', [OsmCandidatesModel::STATUS_OPEN, OsmCandidatesModel::STATUS_LINKED, OsmCandidatesModel::STATUS_REJECTED])
                ->orderBy('id')
                ->limit(500)
                ->get()
                ->getResultArray();

            foreach ($rows as $row) {
                $lastId = $row['id'];
                $tags   = json_decode($row['tags'], true) ?: [];
                $result = $this->scoring->evaluate($row['osm_type'] ?? 'node', $tags, $row['size_m'] !== null ? (int) $row['size_m'] : null, [
                    'wikiSource'   => $row['wiki_source'],
                    'wikiTitle'    => in_array($row['wiki_source'], ['nearby', 'wikidata'], true)
                        ? preg_replace('/^ru:/', '', (string) $row['wikipedia'])
                        : null,
                    'wikiDistance' => $row['wiki_distance'],
                    'sitelinks'    => $row['sitelinks'],
                    'heritage'     => $row['heritage'],
                    'photo'        => !empty(json_decode((string) $row['photos'], true)),
                ]);

                if (is_string($result)) {
                    // A linked candidate stays linked (the place exists whatever the rules say),
                    // a rejected one stays rejected: "gone" would be reopened by the next collection
                    if ($row['status'] === OsmCandidatesModel::STATUS_OPEN) {
                        $this->model->builder()->set('status', OsmCandidatesModel::STATUS_GONE)->where('id', $row['id'])->update();
                        $gone++;
                    }

                    continue;
                }

                $this->model->builder()
                    ->set([
                        'osm_tag'         => $result['osmTag'],
                        'category'        => $result['category'],
                        'name'            => $result['name'],
                        'score'           => $result['score'],
                        'score_breakdown' => json_encode($result['breakdown'], JSON_UNESCAPED_UNICODE),
                        'tier'            => $this->scoring->tier($result['score'], $result['name'], $result['explorable']),
                    ])
                    ->where('id', $row['id'])
                    ->update();

                $updated++;
            }
        } while (count($rows) === 500);

        return ['updated' => $updated, 'gone' => $gone];
    }

    /**
     * Splits the Overpass answer into the tile's objects and the settlements around.
     * An object belongs to the tile of its center: a big lake crossing several tiles
     * is stored once.
     *
     * @return array{0: array, 1: array} objects, settlements
     */
    private function parseElements(array $elements, OsmTileEntity $tile): array
    {
        $objects     = [];
        $settlements = [];

        foreach ($elements as $element) {
            $tags = $element['tags'] ?? [];

            if (isset($tags['place'])) {
                if (isset($tags['name'], $element['lat'], $element['lon'])) {
                    $settlements[] = [
                        'name'       => $tags['name'],
                        'type'       => $tags['place'],
                        'population' => (int) preg_replace('/\D/', '', (string) ($tags['population'] ?? '')),
                        'lat'        => (float) $element['lat'],
                        'lon'        => (float) $element['lon'],
                    ];
                }

                continue;
            }

            $box  = $element['bounds'] ?? null;
            $lat  = $element['lat'] ?? ($box ? ($box['minlat'] + $box['maxlat']) / 2 : null);
            $lon  = $element['lon'] ?? ($box ? ($box['minlon'] + $box['maxlon']) / 2 : null);

            if ($lat === null || $lon === null || !$this->tiles->contains($tile->tile_lat, $tile->tile_lon, $lat, $lon)) {
                continue;
            }

            // Skip the objects that are not candidates at all before any enrichment
            $result = $this->scoring->evaluate($element['type'], $tags);

            if (is_string($result)) {
                $this->skipped[$result] = ($this->skipped[$result] ?? 0) + 1;
                continue;
            }

            $objects[] = [
                'source'     => 'osm',
                'type'       => $element['type'],
                'id'         => (int) $element['id'],
                'heritage'   => isset($tags['ref:okn']) ? mb_substr((string) $tags['ref:okn'], 0, 20) : null,
                'photoFiles' => $this->commonsFilesFromTags($tags),
                'tags'       => $tags,
                'lat'        => round((float) $lat, 6),
                'lon'        => round((float) $lon, 6),
                'size'       => $box ? (int) round(OsmScoring::distance($box['minlat'], $box['minlon'], $box['maxlat'], $box['maxlon'])) : null,
                'name'       => $result['name'],
                'wikipedia'  => $result['wikipedia'],
                'wikidata'   => $result['wikidata'],
                'enrichment' => ['wikiSource' => $result['wikipedia'] || $result['wikidata'] ? 'osm' : null],
            ];
        }

        return [$objects, $settlements];
    }

    /**
     * OSM often has no wikipedia tag even for famous objects, so look for an article
     * with the same title nearby
     */
    private function findNearbyArticles(array &$objects, array $bounds, array $settlementNames): void
    {
        $needed = array_filter($objects, static fn ($object) => $object['name'] && !$object['enrichment']['wikiSource']);

        if (!$needed) {
            return;
        }

        [$south, $west, $north, $east] = $bounds;
        $articles = $this->client->nearbyArticles([
            $south - self::ARTICLES_MARGIN,
            $west - self::ARTICLES_MARGIN,
            $north + self::ARTICLES_MARGIN,
            $east + self::ARTICLES_MARGIN,
        ]);

        if (!$articles) {
            return;
        }

        $matched = [];

        foreach ($needed as $index => $object) {
            $article = $this->scoring->matchNearbyArticle($object['name'], $object['lat'], $object['lon'], $articles, $settlementNames);

            if ($article) {
                $matched[$index] = $article;
            }
        }

        $wikidataIds = $matched ? $this->client->wikidataIds(array_column($matched, 'pageid')) : [];

        foreach ($matched as $index => $article) {
            $objects[$index]['wikipedia']  = 'ru:' . $article['title'];
            $objects[$index]['wikidata']   = $wikidataIds[$article['pageid']] ?? null;
            $objects[$index]['enrichment'] = [
                'wikiSource'   => 'nearby',
                'wikiTitle'    => $article['title'],
                'wikiDistance' => $article['distance'],
            ];
        }
    }

    private function findPopularity(array &$objects): void
    {
        // Wikidata items of the tile already brought their popularity
        $missing   = array_filter($objects, static fn ($object) => $object['wikidata'] && !isset($object['enrichment']['sitelinks']));
        $sitelinks = $missing ? $this->client->sitelinks(array_column($missing, 'wikidata')) : [];

        foreach ($objects as &$object) {
            if ($object['wikidata'] && !isset($object['enrichment']['sitelinks']) && isset($sitelinks[$object['wikidata']])) {
                $object['enrichment']['sitelinks'] = $sitelinks[$object['wikidata']];
            }
        }
    }

    /**
     * Glues the Wikidata items of the tile to the OSM objects and adds the rest as new objects.
     * An item is the same object as an OSM one when the OSM object refers to it (wikidata tag,
     * or the article found nearby), or when it has the same title within `glueRadius`.
     */
    private function addWikidata(array &$objects, array $bounds, OsmTileEntity $tile, array $settlementNames): void
    {
        $items = $this->client->wikidataItems($bounds);

        $byWikidata = [];

        foreach ($objects as $index => $object) {
            if ($object['wikidata']) {
                $byWikidata[$object['wikidata']][] = $index;
            }
        }

        foreach ($items as $item) {
            if (!$this->tiles->contains($tile->tile_lat, $tile->tile_lon, $item['lat'], $item['lon'])) {
                continue;
            }

            if (isset($byWikidata[$item['id']])) {
                foreach ($byWikidata[$item['id']] as $index) {
                    $this->enrichFromWikidata($objects[$index], $item, null);
                }

                $this->glued++;
                continue;
            }

            $match = $item['label'] ? $this->findSameObject($objects, $item) : null;

            if ($match !== null) {
                $this->enrichFromWikidata($objects[$match['index']], $item, $match['distance']);
                $byWikidata[$item['id']] = [$match['index']];
                $this->glued++;
                continue;
            }

            $object = $this->wikidataObject($item, $settlementNames);

            if ($object) {
                $objects[] = $object;
                $this->wikidataOnly++;
            }
        }
    }

    /**
     * The nearest OSM object without a Wikidata link that has the same title as the item
     *
     * @return array{index: int, distance: int}|null
     */
    private function findSameObject(array $objects, array $item): ?array
    {
        $best = null;

        foreach ($objects as $index => $object) {
            if ($object['source'] !== 'osm' || $object['wikidata'] || !$object['name']) {
                continue;
            }

            $distance = OsmScoring::distance($object['lat'], $object['lon'], $item['lat'], $item['lon']);

            if (
                $distance <= $this->config->glueRadius &&
                $this->scoring->titleSimilarity($object['name'], $item['label']) >= 100 &&
                (!$best || $distance < $best['distance'])
            ) {
                $best = ['index' => $index, 'distance' => (int) round($distance)];
            }
        }

        return $best;
    }

    /**
     * Adds what Wikidata knows to an OSM object
     *
     * @param int|null $gluedAt distance when glued by the title, null when the OSM object refers to the item
     */
    private function enrichFromWikidata(array &$object, array $item, ?int $gluedAt): void
    {
        $object['wikidata'] ??= $item['id'];
        $object['heritage'] ??= $item['heritage'] !== null ? mb_substr($item['heritage'], 0, 20) : null;
        $object['enrichment']['sitelinks'] = $item['sitelinks'];

        if ($object['heritage']) {
            $object['enrichment']['heritage'] = $object['heritage'];
        }

        if ($item['image']) {
            $object['photoFiles'][] = $item['image'];
        }

        if ($item['article'] && !$object['wikipedia']) {
            $object['wikipedia'] = 'ru:' . $item['article'];

            // Glued by the title: the article counts as found, like the one found by geosearch
            if ($gluedAt !== null && empty($object['enrichment']['wikiSource'])) {
                $object['enrichment']['wikiSource']   = 'wikidata';
                $object['enrichment']['wikiTitle']    = $item['article'];
                $object['enrichment']['wikiDistance'] = $gluedAt;
            }
        }
    }

    /**
     * A new object found only in Wikidata, or null when it is not a candidate. Items with
     * only a heritage code need a Wikipedia article: there are hundreds of ordinary houses among them.
     */
    private function wikidataObject(array $item, array $settlementNames): ?array
    {
        // The settlement itself: a historic town has a heritage code too
        $title = trim(preg_replace('/\([^)]*\)/u', '', (string) $item['label']));

        foreach ($settlementNames as $settlement) {
            if (mb_strtolower($title) === mb_strtolower($settlement)) {
                $this->skipped['wikidata: settlement'] = ($this->skipped['wikidata: settlement'] ?? 0) + 1;
                return null;
            }
        }

        $class = null;

        foreach (array_keys($this->config->wikidataTypes) as $type) {
            if (in_array($type, $item['classes'], true)) {
                $class = $type;
                break;
            }
        }

        if ($class === null) {
            if (!$item['heritage'] || $item['sitelinks'] < 1) {
                $this->skipped['wikidata: heritage without article'] = ($this->skipped['wikidata: heritage without article'] ?? 0) + 1;
                return null;
            }

            foreach ($this->config->heritageClasses as $pattern => $heritageClass) {
                if (preg_match($pattern, (string) $item['label'])) {
                    $class = $heritageClass;
                    break;
                }
            }
        }

        if ($item['label'] && preg_match($this->config->notObjectArticles, $item['label'])) {
            $this->skipped['wikidata: not an object'] = ($this->skipped['wikidata: not an object'] ?? 0) + 1;
            return null;
        }

        // The Wikidata facts are stored as the "tags": the scores are recalculated from them
        $tags = array_filter([
            'wd:class'  => $class,
            'name'      => $item['label'],
            'wikipedia' => $item['article'] ? 'ru:' . $item['article'] : null,
        ]);

        $enrichment = ['sitelinks' => $item['sitelinks'], 'heritage' => $item['heritage']];
        $result     = $this->scoring->evaluate('node', $tags, null, $enrichment);

        if (is_string($result)) {
            $this->skipped["wikidata {$result}"] = ($this->skipped["wikidata {$result}"] ?? 0) + 1;
            return null;
        }

        return [
            'source'     => 'wikidata',
            'type'       => null,
            'id'         => null,
            'heritage'   => $item['heritage'] !== null ? mb_substr($item['heritage'], 0, 20) : null,
            'photoFiles' => $item['image'] ? [$item['image']] : [],
            'tags'       => $tags,
            'lat'        => round($item['lat'], 6),
            'lon'        => round($item['lon'], 6),
            'size'       => null,
            'name'       => $item['label'],
            'wikipedia'  => $tags['wikipedia'] ?? null,
            'wikidata'   => $item['id'],
            'enrichment' => $enrichment,
        ];
    }

    /**
     * Commons photos of the objects with their author and licence
     */
    private function findPhotos(array &$objects): void
    {
        $files = array_merge(...array_map(static fn ($object) => $object['photoFiles'], $objects ?: [['photoFiles' => []]]));

        $photos = $files ? $this->client->commonsPhotos($files) : [];

        foreach ($objects as &$object) {
            $list = [];

            foreach (array_unique(array_map(static fn ($file) => str_replace('_', ' ', $file), $object['photoFiles'])) as $file) {
                if (isset($photos[$file]) && count($list) < $this->config->maxPhotos) {
                    $list[] = $photos[$file];
                }
            }

            $object['photos'] = $list;

            if ($list) {
                $object['enrichment']['photo'] = true;
            }
        }
    }

    /**
     * Commons file names from the OSM tags: wikimedia_commons=File:…, or an image link to Commons
     *
     * @return string[]
     */
    private function commonsFilesFromTags(array $tags): array
    {
        $files = [];

        if (str_starts_with((string) ($tags['wikimedia_commons'] ?? ''), 'File:')) {
            $files[] = substr($tags['wikimedia_commons'], 5);
        }

        $image = (string) ($tags['image'] ?? '');

        if (preg_match('~commons\.wikimedia\.org/wiki/File:(.+)$~', $image, $match)) {
            $files[] = rawurldecode($match[1]);
        } elseif (preg_match('~upload\.wikimedia\.org/wikipedia/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/]+)~', $image, $match)) {
            $files[] = rawurldecode($match[1]);
        }

        return $files;
    }

    /**
     * Runs a step and adds its time to `timings`
     */
    private function timed(string $step, callable $callback): mixed
    {
        $startedAt = microtime(true);

        try {
            return $callback();
        } finally {
            $this->timings[$step] = round(microtime(true) - $startedAt, 2);
        }
    }

    /**
     * Upserts the candidates (OSM objects by their OSM id, Wikidata-only ones by their Q-id)
     * and marks the tile's missing ones as gone
     */
    private function save(array $objects, OsmTileEntity $tile): int
    {
        $now      = Time::now()->toDateTimeString();
        $existing = [];

        // All the Q-ids, not only of the Wikidata-only objects: an item that was Wikidata-only before
        // may have been glued to an OSM object since (somebody added the wikidata tag in OSM)
        $osmIds      = array_filter(array_column($objects, 'id'));
        $wikidataIds = array_values(array_unique(array_filter(array_column($objects, 'wikidata'))));

        if ($osmIds || $wikidataIds) {
            $query = $this->model->builder()->select('id, source, osm_type, osm_id, wikidata, status')->groupStart();

            if ($osmIds) {
                $query->orWhereIn('osm_id', $osmIds);
            }

            if ($wikidataIds) {
                $query->orGroupStart()->where('source', 'wikidata')->whereIn('wikidata', $wikidataIds)->groupEnd();
            }

            foreach ($query->groupEnd()->get()->getResultArray() as $row) {
                $existing[$this->objectKey($row['source'], $row['osm_type'], $row['osm_id'], $row['wikidata'])] = $row;
            }
        }

        $seenIds = [];

        foreach ($objects as $object) {
            $result = $object['result'];
            $old    = $existing[$this->objectKey($object['source'], $object['type'], $object['id'], $object['wikidata'])] ?? null;

            // The former Wikidata-only row becomes the OSM object's row, with its link or rejection
            if (!$old && $object['source'] === 'osm' && $object['wikidata']) {
                $former = $existing[$this->objectKey('wikidata', null, null, $object['wikidata'])] ?? null;

                if ($former && !in_array($former['id'], $seenIds, true)) {
                    $old = $former;
                }
            }

            $data = [
                'source'              => $object['source'],
                'tile_id'             => $tile->id,
                'lat'                 => $object['lat'],
                'lon'                 => $object['lon'],
                'size_m'              => $object['size'],
                'name'                => $result['name'] !== null ? mb_substr($result['name'], 0, 250) : null,
                'osm_tag'             => $result['osmTag'],
                'category'            => $result['category'],
                'tags'                => json_encode($object['tags'], JSON_UNESCAPED_UNICODE),
                'wikipedia'           => $object['wikipedia'] !== null ? mb_substr($object['wikipedia'], 0, 250) : null,
                'wikidata'            => $object['wikidata'] !== null ? mb_substr($object['wikidata'], 0, 20) : null,
                'wiki_source'         => $object['enrichment']['wikiSource'] ?? null,
                'wiki_distance'       => $object['enrichment']['wikiDistance'] ?? null,
                'sitelinks'           => $object['enrichment']['sitelinks'] ?? null,
                'heritage'            => $object['heritage'],
                'photos'              => $object['photos'] ? json_encode($object['photos'], JSON_UNESCAPED_UNICODE) : null,
                'settlement_name'     => $object['settlement'] ? mb_substr($object['settlement']['name'], 0, 150) : null,
                'settlement_type'     => $object['settlement']['type'] ?? null,
                'settlement_distance' => $object['settlement']['distance'] ?? null,
                'score'               => $result['score'],
                'score_breakdown'     => json_encode($result['breakdown'], JSON_UNESCAPED_UNICODE),
                'tier'                => $this->scoring->tier($result['score'], $result['name'], $result['explorable']),
                'seen_at'             => $now,
                'updated_at'          => $now,
            ];

            if ($old) {
                // Links and rejections are kept; an object that came back is open again
                if ($old['status'] === OsmCandidatesModel::STATUS_GONE) {
                    $data['status'] = OsmCandidatesModel::STATUS_OPEN;
                }

                if ($old['source'] !== $object['source']) {
                    $data += ['osm_type' => $object['type'], 'osm_id' => $object['id']];
                }

                $this->model->builder()->set($data)->where('id', $old['id'])->update();
                $seenIds[] = $old['id'];
            } else {
                $id = $this->model->createId();

                $this->model->builder()->insert($data + [
                    'id'         => $id,
                    'osm_type'   => $object['type'],
                    'osm_id'     => $object['id'],
                    'status'     => OsmCandidatesModel::STATUS_OPEN,
                    'created_at' => $now,
                ]);

                $seenIds[] = $id;
            }
        }

        $gone = $this->model->builder()
            ->set('status', OsmCandidatesModel::STATUS_GONE)
            ->where('tile_id', $tile->id)
            ->where('status', OsmCandidatesModel::STATUS_OPEN);

        if ($seenIds) {
            $gone->whereNotIn('id', $seenIds);
        }

        $gone->update();

        return count($objects);
    }

    private function objectKey(string $source, ?string $osmType, mixed $osmId, ?string $wikidata): string
    {
        return $source === 'wikidata' ? "wd:{$wikidata}" : "osm:{$osmType}/{$osmId}";
    }
}
