<?php

namespace App\Models;

use App\Entities\OsmCandidateEntity;
use App\Libraries\OsmScoring;
use CodeIgniter\I18n\Time;

/**
 * Model for the `osm_candidates` table: interesting OSM objects that are not on Geometki yet.
 *
 * Filled only by the background collector (see App\Libraries\OsmCollector);
 * the map reads it and never asks Overpass itself.
 *
 * @package App\Models
 */
class OsmCandidatesModel extends ApplicationBaseModel
{
    public const STATUS_OPEN     = 'open';
    public const STATUS_LINKED   = 'linked';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_GONE     = 'gone';

    protected $table            = 'osm_candidates';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = OsmCandidateEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'id',
        'source',
        'osm_type',
        'osm_id',
        'tile_id',
        'lat',
        'lon',
        'size_m',
        'name',
        'osm_tag',
        'category',
        'tags',
        'wikipedia',
        'wikidata',
        'wiki_source',
        'wiki_distance',
        'sitelinks',
        'heritage',
        'photos',
        'settlement_name',
        'settlement_type',
        'settlement_distance',
        'score_breakdown',
        'score',
        'tier',
        'status',
        'place_id',
        'linked_by',
        'linked_at',
        'seen_at',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    /**
     * Candidates inside the bounds for the map. A candidate linked to a place that was deleted
     * afterwards is open again.
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds south, west, north, east
     * @param string[] $tiers
     * @param bool     $withLinked include the linked ones (for admins)
     * @return array<int, array>
     */
    public function findForMap(array $bounds, array $tiers, bool $withLinked, int $limit): array
    {
        [$south, $west, $north, $east] = $bounds;

        $builder = $this->builder()
            ->select(
                'osm_candidates.id, osm_candidates.source, osm_candidates.osm_type, osm_candidates.osm_id,'
                . ' osm_candidates.lat, osm_candidates.lon, osm_candidates.heritage, osm_candidates.photos,'
                . ' osm_candidates.size_m, osm_candidates.name, osm_candidates.osm_tag, osm_candidates.category,'
                . ' osm_candidates.tags, osm_candidates.wikipedia, osm_candidates.wikidata, osm_candidates.sitelinks,'
                . ' osm_candidates.settlement_name, osm_candidates.settlement_type, osm_candidates.settlement_distance,'
                . ' osm_candidates.score, osm_candidates.score_breakdown,'
                . ' osm_candidates.tier, osm_candidates.status, places.id as linked_place_id'
            )
            ->join('places', 'places.id = osm_candidates.place_id AND places.deleted_at IS NULL', 'left')
            ->where('osm_candidates.lat >=', $south)
            ->where('osm_candidates.lat <=', $north)
            ->where('osm_candidates.lon >=', $west)
            ->where('osm_candidates.lon <=', $east)
            ->whereIn('osm_candidates.tier', $tiers)
            ->groupStart()
                ->where('osm_candidates.status', self::STATUS_OPEN)
                ->orGroupStart()
                    ->where('osm_candidates.status', self::STATUS_LINKED)
                    ->where('places.id IS NULL', null, false)
                ->groupEnd();

        if ($withLinked) {
            $builder->orGroupStart()
                ->where('osm_candidates.status', self::STATUS_LINKED)
                ->where('places.id IS NOT NULL', null, false)
                ->groupEnd();
        }

        return $builder->groupEnd()
            ->orderBy('osm_candidates.score', 'DESC')
            ->limit($limit)
            ->get()
            ->getResultArray();
    }

    /**
     * Links a candidate to a place: by an admin, or when a place is created from the candidate.
     * A linked candidate is no longer shown to users.
     *
     * @param bool $force relink an already linked or rejected candidate (admin)
     * @return bool false when the candidate does not exist or is already linked to an existing place
     */
    public function linkToPlace(string $candidateId, string $placeId, ?string $userId, bool $force = false): bool
    {
        $candidate = $this->find($candidateId);

        if (!$candidate || $candidate->status === self::STATUS_GONE) {
            return false;
        }

        if (!$force && $candidate->status !== self::STATUS_OPEN) {
            // A link to a place that was deleted afterwards does not count
            $linkedPlace = $candidate->place_id ? (new PlacesModel())->select('id')->find($candidate->place_id) : null;

            if ($candidate->status !== self::STATUS_LINKED || $linkedPlace) {
                return false;
            }
        }

        $now = Time::now()->toDateTimeString();

        // The status must still be the one checked above: two places created from the same
        // candidate at the same time must not both take it
        $this->builder()
            ->set([
                'status'     => self::STATUS_LINKED,
                'place_id'   => $placeId,
                'linked_by'  => $userId,
                'linked_at'  => $now,
                'updated_at' => $now,
            ])
            ->where('id', $candidateId)
            ->where('status', $candidate->status)
            ->update();

        return $this->db->affectedRows() === 1;
    }

    /**
     * Links a candidate to a place just created from it. The place must stand near the candidate
     * and look like it (a similar title, or the same category very close): otherwise any user
     * could hide any candidate by creating a place anywhere around.
     *
     * @param string[] $titles titles of the new place
     * @return bool false when the candidate is taken, gone, too far or not similar
     */
    public function linkToNewPlace(
        string $candidateId,
        string $placeId,
        ?string $userId,
        float $lat,
        float $lon,
        string $category,
        array $titles,
        ?OsmScoring $scoring = null
    ): bool {
        $candidate = $this->find($candidateId);

        if (!$candidate) {
            return false;
        }

        $scoring ??= new OsmScoring(config('OsmCandidates'));

        $similar = $scoring->isNewPlaceOf(
            $candidate->name,
            (string) $candidate->category,
            (float) $candidate->lat,
            (float) $candidate->lon,
            ['category' => $category, 'lat' => $lat, 'lon' => $lon, 'titles' => $titles]
        );

        return $similar && $this->linkToPlace($candidateId, $placeId, $userId);
    }

    /**
     * Our places in the area with their titles, for the duplicate rules (OsmScoring::duplicateOf()).
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds south, west, north, east
     * @param float $margin degrees around the bounds
     * @return array<int, array> [id, category, lat, lon, titles]
     */
    public function placesAround(array $bounds, float $margin = 0.01): array
    {
        [$south, $west, $north, $east] = $bounds;

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
     * Stores the duplicates: every open candidate in the bounds that looks
     * like one of our places (OsmScoring::duplicateOf()) is linked to it automatically,
     * `linked_by` NULL. Called after a tile is collected, after a place is created or moved
     * (the bounds around it), and by `osm:link-duplicates` for the stored ones. Only the open
     * candidates: a link set by a person, a rejection, a gone one are kept.
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds south, west, north, east
     * @return int how many candidates got linked
     */
    public function linkDuplicatesIn(array $bounds, ?OsmScoring $scoring = null): int
    {
        [$south, $west, $north, $east] = $bounds;

        $places = $this->placesAround($bounds);

        if (!$places) {
            return 0;
        }

        $scoring ??= new OsmScoring(config('OsmCandidates'));
        $grid   = $scoring->placesGrid($places, max(abs($south), abs($north)));
        $linked = 0;
        $now    = Time::now()->toDateTimeString();

        $rows = $this->builder()
            ->select('id, name, category, lat, lon')
            ->where('status', self::STATUS_OPEN)
            ->where('lat >=', $south)->where('lat <=', $north)
            ->where('lon >=', $west)->where('lon <=', $east)
            ->get()->getResultArray();

        foreach ($rows as $row) {
            foreach ($scoring->placesNear($grid, (float) $row['lat'], (float) $row['lon']) as $place) {
                if ($scoring->duplicateOf($row['name'], (string) $row['category'], (float) $row['lat'], (float) $row['lon'], $place) === null) {
                    continue;
                }

                $this->builder()
                    ->set([
                        'status'     => self::STATUS_LINKED,
                        'place_id'   => $place['id'],
                        'linked_by'  => null,
                        'linked_at'  => $now,
                        'updated_at' => $now,
                    ])
                    ->where('id', $row['id'])
                    ->where('status', self::STATUS_OPEN)
                    ->update();

                $linked += $this->db->affectedRows();
                break;
            }
        }

        return $linked;
    }

    /**
     * The duplicates around one place, after it was created or moved: the bounds of the
     * duplicate radius around it.
     */
    public function linkDuplicatesAround(float $lat, float $lon): int
    {
        $margin    = config('OsmCandidates')->duplicateRadius / 111000 * 1.5;
        $lonMargin = $margin / max(cos(deg2rad($lat)), 0.1);

        return $this->linkDuplicatesIn([$lat - $margin, $lon - $lonMargin, $lat + $margin, $lon + $lonMargin]);
    }

    /**
     * After a place was moved: the candidates linked to it automatically that are now farther
     * than the duplicate radius are open again. Links by hand (an admin's) and the pioneer's
     * (the place was created from the candidate) stay: they were made on purpose.
     *
     * @return int how many candidates are open again
     */
    public function reopenFarFrom(string $placeId, float $lat, float $lon): int
    {
        $radius = config('OsmCandidates')->duplicateRadius;
        $rows   = $this->builder()
            ->select('id, lat, lon')
            ->where('place_id', $placeId)
            ->where('status', self::STATUS_LINKED)
            ->where('linked_by', null)
            ->get()->getResultArray();

        $far = [];

        foreach ($rows as $row) {
            $dLat = deg2rad((float) $row['lat'] - $lat);
            $dLon = deg2rad((float) $row['lon'] - $lon) * cos(deg2rad($lat));

            if (sqrt($dLat ** 2 + $dLon ** 2) * 6371000 > $radius) {
                $far[] = $row['id'];
            }
        }

        if (!$far) {
            return 0;
        }

        $this->builder()
            ->set([
                'status'     => self::STATUS_OPEN,
                'place_id'   => null,
                'linked_at'  => null,
                'updated_at' => Time::now()->toDateTimeString(),
            ])
            ->whereIn('id', $far)
            ->where('status', self::STATUS_LINKED)
            ->update();

        return $this->db->affectedRows();
    }

    /**
     * Before a place is deleted: the candidates linked to it are open again (the place's key
     * would only clear `place_id`, leaving them `linked`). The pioneer's link goes too: the
     * place is gone, so is the credit.
     *
     * @return int how many candidates are open again
     */
    public function reopenOfPlace(string $placeId): int
    {
        $this->builder()
            ->set([
                'status'     => self::STATUS_OPEN,
                'place_id'   => null,
                'linked_by'  => null,
                'linked_at'  => null,
                'updated_at' => Time::now()->toDateTimeString(),
            ])
            ->where('place_id', $placeId)
            ->where('status', self::STATUS_LINKED)
            ->update();

        return $this->db->affectedRows();
    }

    /**
     * The white spots a person opened: the candidates linked to a place of theirs that they
     * created from the candidate (`linked_by` is the author; an admin linking somebody else's
     * place by hand is no pioneer). Counted for the experience (MODIFIER_SPOT) and the
     * `spots_opened` metric.
     */
    public function spotsOpened(string $userId): int
    {
        return (int) $this->builder()
            ->selectCount('osm_candidates.id', 'cnt')
            ->join('places', 'places.id = osm_candidates.place_id AND places.deleted_at IS NULL AND places.user_id = osm_candidates.linked_by')
            ->where('osm_candidates.linked_by', $userId)
            ->where('osm_candidates.status', self::STATUS_LINKED)
            ->get()->getRow()->cnt;
    }
}
