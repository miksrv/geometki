<?php

namespace App\Models;

use App\Entities\LocationSlugEntity;

/**
 * Model for the `location_slugs` table.
 *
 * One shared slug namespace across all four location levels. See
 * App\Libraries\LocationSlugLibrary for generation and collision handling.
 *
 * @package App\Models
 */
class LocationSlugsModel extends ApplicationBaseModel
{
    protected $table            = 'location_slugs';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = LocationSlugEntity::class;
    protected $useSoftDeletes   = false;
    protected $useTimestamps    = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'slug',
        'type',
        'entity_id',
        'is_primary',
    ];

    protected $validationRules = [
        'slug'       => 'required|string|max_length[90]',
        'type'       => 'required|in_list[country,region,district,locality]',
        'entity_id'  => 'required|integer',
        'is_primary' => 'permit_empty|in_list[0,1]',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = false;

    /**
     * Whether a slug is already taken by any location, at any level.
     *
     * @param string $slug
     * @return bool
     */
    public function isTaken(string $slug): bool
    {
        return $this->where('slug', $slug)->countAllResults() > 0;
    }

    /**
     * The current slug row for a given location, if it already has one.
     *
     * @param string $type
     * @param int    $entityId
     * @return LocationSlugEntity|null
     */
    public function findFor(string $type, int $entityId): ?LocationSlugEntity
    {
        return $this->where(['type' => $type, 'entity_id' => $entityId])->first();
    }

    /**
     * Resolves a slug to its location, following the shared namespace.
     *
     * @param string $slug
     * @return LocationSlugEntity|null
     */
    public function findBySlug(string $slug): ?LocationSlugEntity
    {
        return $this->where('slug', $slug)->first();
    }
}
