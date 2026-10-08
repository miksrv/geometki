<?php

namespace App\Controllers;

use App\Libraries\OsmScoring;
use App\Libraries\OsmTiles;
use App\Libraries\SessionLibrary;
use App\Models\OsmCandidatesModel;
use App\Models\OsmTilesModel;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\I18n\Time;
use CodeIgniter\RESTful\ResourceController;
use Config\OsmCandidates as OsmCandidatesConfig;
use Config\Services;

/**
 * OSM candidates: interesting objects from OpenStreetMap that are not on Geometki yet.
 *
 * The map reads only our database. Tiles of the requested area that were never collected
 * are queued for the background collector (`php spark osm:collect`), so a user request
 * never waits for Overpass.
 *
 * @package App\Controllers
 */
class OsmCandidates extends ResourceController
{
    private const TIERS = [OsmScoring::TIER_KNOWN, OsmScoring::TIER_EXPLORE, OsmScoring::TIER_OTHER];

    /** Margin around the area when looking for our places, degrees */
    private const PLACES_MARGIN = 0.01;

    protected SessionLibrary $session;
    protected OsmCandidatesConfig $config;
    protected OsmScoring $scoring;

    /** @var OsmCandidatesModel */
    protected $model;

    public function __construct()
    {
        $this->model   = new OsmCandidatesModel();
        $this->session = new SessionLibrary();
        $this->config  = config('OsmCandidates');
        $this->scoring = new OsmScoring($this->config);
    }

    /**
     * Candidates inside the map area.
     *
     * GET /osm-candidates?bounds=south,west,north,east&tiers=known,explore
     *
     * Objects that are already on Geometki (linked, or found as duplicates of our places)
     * are returned only to admins, with `status` linked / duplicate.
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $bounds = OsmTiles::parseBounds($this->request->getGet('bounds'));

        if (!$bounds) {
            return $this->failValidationErrors(lang('OsmCandidates.invalidBounds'));
        }

        [$south, $west, $north, $east] = $bounds;

        if (($north - $south) * ($east - $west) > $this->config->maxRequestArea) {
            return $this->respond(['tooLarge' => true, 'items' => [], 'pendingTiles' => 0]);
        }

        $tiers = array_values(array_intersect(
            explode(',', (string) ($this->request->getGet('tiers') ?: 'known,explore')),
            self::TIERS
        ));

        $isAdmin = $this->isAdmin();
        $locale  = $this->request->getLocale();

        // Ask for the tiles in the background and report how many are being collected.
        // Limited per IP, so that a script walking the map cannot flood the queue
        $tiles = $this->mayQueueTiles()
            ? (new OsmTilesModel())->request((new OsmTiles($this->config))->tilesInBounds($bounds))
            : [];
        // Only the tiles that are really being collected: a failed one waits for its retry for hours
        $pendingTiles = count(array_filter($tiles, static fn ($tile) => $tile['fetched_at'] === null
            && in_array($tile['status'], [OsmTilesModel::STATUS_QUEUED, OsmTilesModel::STATUS_PROCESSING], true)));

        $rows   = $tiers ? $this->model->findForMap($bounds, $tiers, $isAdmin, $this->config->maxItemsPerResponse) : [];
        $places = $rows ? $this->placesAround($bounds) : [];
        $grid   = $this->scoring->placesGrid($places, max(abs($south), abs($north)));

        $items = [];

        foreach ($rows as $row) {
            $item = $this->formatItem($row, $locale, $places, $grid);

            if ($item['status'] !== 'open' && !$isAdmin) {
                continue;
            }

            $items[] = $item;
        }

        return $this->respond([
            'items'        => $items,
            'pendingTiles' => $pendingTiles,
        ]);
    }

    /**
     * One candidate, e.g. to prefill the new place form.
     *
     * GET /osm-candidates/:id
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $row = $this->findRow($id);

        if (!$row) {
            return $this->failNotFound(lang('OsmCandidates.notFound'));
        }

        $places = $this->placesAround([$row['lat'], $row['lon'], $row['lat'], $row['lon']]);
        $grid   = $this->scoring->placesGrid($places, (float) $row['lat']);

        return $this->respond($this->formatItem($row, $this->request->getLocale(), $places, $grid));
    }

    /**
     * Admin: link a candidate to an existing place, the same link as when a place is created from it.
     *
     * PATCH /osm-candidates/:id/link — body: { placeId }
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function link($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!$this->isAdmin()) {
            return $this->failForbidden();
        }

        $placeId = (string) ($this->request->getJSON()?->placeId ?? '');
        $place   = $placeId !== '' ? (new PlacesModel())->select('id')->find($placeId) : null;

        if (!$place) {
            return $this->failValidationErrors(lang('OsmCandidates.placeNotFound'));
        }

        if (!$this->model->linkToPlace((string) $id, $place->id, $this->session->user->id, true)) {
            return $this->failNotFound(lang('OsmCandidates.notFound'));
        }

        return $this->respondUpdated(['id' => $id, 'placeId' => $place->id]);
    }

    /**
     * Admin: remove a wrong link, the candidate becomes open again.
     *
     * PATCH /osm-candidates/:id/unlink
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function unlink($id = null): ResponseInterface
    {
        return $this->setStatus($id, OsmCandidatesModel::STATUS_OPEN);
    }

    /**
     * Admin: hide a candidate for good, it is not shown and not brought back by re-collection.
     *
     * PATCH /osm-candidates/:id/reject
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function reject($id = null): ResponseInterface
    {
        return $this->setStatus($id, OsmCandidatesModel::STATUS_REJECTED);
    }

    private function setStatus(?string $id, string $status): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!$this->isAdmin()) {
            return $this->failForbidden();
        }

        if (!$this->model->find($id)) {
            return $this->failNotFound(lang('OsmCandidates.notFound'));
        }

        $data = ['status' => $status, 'updated_at' => Time::now()->toDateTimeString()];

        if ($status === OsmCandidatesModel::STATUS_OPEN) {
            $data += ['place_id' => null, 'linked_by' => null, 'linked_at' => null];
        }

        $this->model->builder()->set($data)->where('id', $id)->update();

        return $this->respondUpdated(['id' => $id, 'status' => $status]);
    }

    private function findRow(?string $id): ?array
    {
        if (!$id) {
            return null;
        }

        return $this->model->builder()
            ->select('osm_candidates.*, places.id as linked_place_id')
            ->join('places', 'places.id = osm_candidates.place_id AND places.deleted_at IS NULL', 'left')
            ->where('osm_candidates.id', $id)
            ->whereIn('osm_candidates.status', [OsmCandidatesModel::STATUS_OPEN, OsmCandidatesModel::STATUS_LINKED])
            ->get()
            ->getRowArray();
    }

    /**
     * Our places around the area with all their titles, to find the duplicates
     *
     * @return array<int, array> [id, category, lat, lon, titles]
     */
    private function placesAround(array $bounds): array
    {
        [$south, $west, $north, $east] = $bounds;
        $margin = self::PLACES_MARGIN;

        $rows = (new PlacesModel())
            ->select('places.id, places.category, places.lat, places.lon, GROUP_CONCAT(places_content.title SEPARATOR "\n") as titles')
            ->join('places_content', 'places_content.place_id = places.id', 'left')
            ->where([
                'places.lat >=' => $south - $margin,
                'places.lat <=' => $north + $margin,
                'places.lon >=' => $west - $margin,
                'places.lon <=' => $east + $margin,
            ])
            ->groupBy('places.id')
            ->asArray()
            ->findAll();

        foreach ($rows as &$row) {
            $row['titles'] = array_values(array_unique(array_filter(explode("\n", (string) $row['titles']))));
        }

        return $rows;
    }

    /**
     * API shape of a candidate. `status`: open, linked (to `place`), or duplicate
     * (an existing place in `place` looks like the same object)
     */
    private function formatItem(array $row, string $locale, array $places, array $grid): array
    {
        $tags   = json_decode($row['tags'] ?? '[]', true) ?: [];
        $place  = null;
        $status = 'open';

        if ($row['status'] === OsmCandidatesModel::STATUS_LINKED && !empty($row['linked_place_id'])) {
            $status = 'linked';
            $place  = $this->placeInfo($row['linked_place_id'], $places);
        } else {
            foreach ($this->scoring->placesNear($grid, (float) $row['lat'], (float) $row['lon']) as $candidatePlace) {
                $similarity = $this->scoring->duplicateOf(
                    $row['name'],
                    (string) $row['category'],
                    (float) $row['lat'],
                    (float) $row['lon'],
                    $candidatePlace
                );

                if ($similarity !== null) {
                    $status = 'duplicate';
                    $place  = [
                        'id'         => $candidatePlace['id'],
                        'title'      => $candidatePlace['titles'][0] ?? null,
                        'similarity' => $similarity,
                    ];
                    break;
                }
            }
        }

        $photos = json_decode((string) ($row['photos'] ?? ''), true) ?: [];

        return [
            'id'         => $row['id'],
            'source'     => $row['source'],
            'osmType'    => $row['osm_type'],
            'osmId'      => $row['osm_id'] !== null ? (int) $row['osm_id'] : null,
            'lat'        => (float) $row['lat'],
            'lon'        => (float) $row['lon'],
            'name'       => $row['name'],
            'typeTitle'  => $this->scoring->typeTitle($row['osm_tag'], $locale),
            'osmTag'     => $row['osm_tag'],
            'category'   => $row['category'],
            'tier'       => $row['tier'],
            'score'      => (int) $row['score'],
            'breakdown'  => json_decode($row['score_breakdown'] ?? '[]', true) ?: [],
            'wikipedia'  => $this->wikipediaValue($row['wikipedia']),
            'wikidata'   => $row['wikidata'],
            'photos'     => $photos,
            // A photo without a known licence (an OSM image link) is shown only when there is no Commons one
            'image'      => $photos ? null : $this->imageUrl($tags),
            'heritage'   => $row['heritage'],
            'ele'        => isset($tags['ele']) ? (float) $tags['ele'] : null,
            'size'       => $row['size_m'] !== null ? (int) $row['size_m'] : null,
            'settlement' => $row['settlement_name'] ? [
                'name'     => $row['settlement_name'],
                'type'     => $row['settlement_type'],
                'distance' => (int) $row['settlement_distance'],
            ] : null,
            'status'     => $status,
            'place'      => $place,
        ];
    }

    private function placeInfo(string $placeId, array $places): array
    {
        foreach ($places as $place) {
            if ($place['id'] === $placeId) {
                return ['id' => $placeId, 'title' => $place['titles'][0] ?? null];
            }
        }

        $content = (new PlacesModel())->builder()
            ->select('places_content.title')
            ->join('places_content', 'places_content.place_id = places.id')
            ->where('places.id', $placeId)
            ->get(1)
            ->getRow();

        return ['id' => $placeId, 'title' => $content->title ?? null];
    }

    /**
     * A photo from the OSM tags: a direct image link or a Wikimedia Commons file
     */
    private function imageUrl(array $tags): ?string
    {
        $image = $tags['image'] ?? null;

        // https only: an http image is mixed content on our https pages
        if ($image && preg_match('/^https:\/\/[^\s"<>]+\.(jpe?g|png|webp)$/i', $image)) {
            return $image;
        }

        $commons = $tags['wikimedia_commons'] ?? null;

        if ($commons && str_starts_with($commons, 'File:')) {
            return 'https://commons.wikimedia.org/wiki/Special:FilePath/' . rawurlencode(substr($commons, 5)) . '?width=400';
        }

        return null;
    }

    /**
     * "lang:Title" as OSM keeps it. Anything else (a pasted URL, a typo) would make a broken
     * or a foreign link on the client, so it is dropped
     */
    private function wikipediaValue(?string $value): ?string
    {
        return $value !== null && preg_match('/^[a-z][a-z-]{1,11}:[^\/\s]/', $value) ? $value : null;
    }

    private function mayQueueTiles(): bool
    {
        $key = 'osm_tiles_' . md5($this->request->getIPAddress());

        return Services::throttler()->check($key, $this->config->queueRequestsPerMinute, MINUTE);
    }

    private function isAdmin(): bool
    {
        return $this->session->isAuth && $this->session->user?->role === 'admin';
    }
}
