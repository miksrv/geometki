<?php

namespace App\Models;

use App\Entities\LocationLegacyIdEntity;

/**
 * Model for the `location_legacy_ids` table.
 *
 * TEMPORARY — see the comment on the AddLocationLegacyIds migration. Maps a
 * pre-rebuild location id (type + old_id) to the id it was merged into or
 * kept as (new_id), so old `/places?region=2`-style URLs can 301 once the
 * location SEO pages (features/20-location-seo-pages.md) ship. Filled once
 * by `php spark locations:rebuild`.
 *
 * @package App\Models
 */
class LocationLegacyIdsModel extends ApplicationBaseModel
{
    protected $table            = 'location_legacy_ids';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = LocationLegacyIdEntity::class;
    protected $useSoftDeletes   = false;
    protected $useTimestamps    = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'location_type',
        'old_id',
        'new_id',
    ];

    protected $validationRules = [
        'location_type' => 'required|in_list[country,region,district,locality]',
        'old_id'        => 'required|integer',
        'new_id'        => 'required|integer',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = false;

    /**
     * Resolves a pre-rebuild id to its current id. Returns the input id
     * unchanged when it was never remapped (i.e. it already is the current
     * id, or it does not exist at all — the caller is expected to check
     * existence separately).
     *
     * Endpoint-ready lookup for the future 301 redirect of old location
     * query-string URLs; no route/controller wires it up yet.
     *
     * @param string $locationType country|region|district|locality
     * @param int    $oldId
     * @return int
     */
    public function resolve(string $locationType, int $oldId): int
    {
        $row = $this->where([
            'location_type' => $locationType,
            'old_id'        => $oldId,
        ])->first();

        return $row ? $row->new_id : $oldId;
    }
}
