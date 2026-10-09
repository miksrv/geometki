<?php

namespace App\Models;

use App\Entities\LocationSlugHistoryEntity;

/**
 * Model for the `location_slug_history` table.
 *
 * Every slug a location has had other than its current one, so an old URL
 * can 301 to the current one. A row is written whenever a location's
 * primary slug changes (manual override, duplicate merge, or a primary-slug
 * reassignment during a rebuild) — never on first assignment.
 *
 * @package App\Models
 */
class LocationSlugHistoryModel extends ApplicationBaseModel
{
    protected $table            = 'location_slug_history';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = LocationSlugHistoryEntity::class;
    protected $useSoftDeletes   = false;
    protected $useTimestamps    = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'old_slug',
        'type',
        'entity_id',
    ];

    protected $validationRules = [
        'old_slug'  => 'required|string|max_length[90]',
        'type'      => 'required|in_list[country,region,district,locality]',
        'entity_id' => 'required|integer',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = false;

    /**
     * Resolves a historical slug to the location it now belongs to (type +
     * entity_id) — the caller looks up the current slug from
     * LocationSlugsModel::findFor() to build the 301 target.
     *
     * @param string $oldSlug
     * @return LocationSlugHistoryEntity|null
     */
    public function findByOldSlug(string $oldSlug): ?LocationSlugHistoryEntity
    {
        return $this->where('old_slug', $oldSlug)->first();
    }
}
