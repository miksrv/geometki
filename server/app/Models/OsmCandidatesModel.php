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
}
