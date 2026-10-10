<?php

namespace App\Models;

use App\Entities\LocationAliasEntity;

/**
 * Model for the `location_aliases` table.
 *
 * Every name a location has ever been known by (old and new geocoder
 * providers, Russian and English), normalized via normalizeLocationName().
 * Used as the geocoder's third matching step, after OSM id and ISO code:
 * find an existing location by a normalized name within the same parent
 * before creating a new row. See App\Libraries\LocationMatcher.
 *
 * @package App\Models
 */
class LocationAliasesModel extends ApplicationBaseModel
{
    protected $table            = 'location_aliases';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = LocationAliasEntity::class;
    protected $useSoftDeletes   = false;
    protected $useTimestamps    = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'location_type',
        'location_id',
        'parent_id',
        'name_normalized',
    ];

    protected $validationRules = [
        'location_type'   => 'required|in_list[country,region,district,locality]',
        'location_id'     => 'required|integer',
        'parent_id'       => 'permit_empty|integer',
        'name_normalized' => 'required|string|max_length[150]',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = false;

    /**
     * Finds the location a normalized name is already an alias of, within a
     * given parent scope.
     *
     * @param string $locationType country|region|district|locality
     * @param int    $parentId     0 for country (no parent)
     * @param string $nameNormalized
     * @return LocationAliasEntity|null
     */
    public function findMatch(string $locationType, int $parentId, string $nameNormalized): ?LocationAliasEntity
    {
        if ($nameNormalized === '') {
            return null;
        }

        return $this->where([
            'location_type'   => $locationType,
            'parent_id'       => $parentId,
            'name_normalized' => $nameNormalized,
        ])->first();
    }

    /**
     * Records a name as an alias of a location, within its parent scope, if
     * it is not already recorded (insert-if-missing — safe to call on every
     * successful geocoder resolution and repeatedly during the rebuild).
     *
     * @param string $locationType
     * @param int    $locationId
     * @param int    $parentId
     * @param string|null $name Raw (not normalized) name; skipped if blank
     * @return void
     */
    public function remember(string $locationType, int $locationId, int $parentId, ?string $name): void
    {
        helper('location');

        $normalized = normalizeLocationName($name);

        if ($normalized === '') {
            return;
        }

        $existing = $this->findMatch($locationType, $parentId, $normalized);

        if ($existing) {
            return;
        }

        $this->skipValidation(false)->insert([
            'location_type'   => $locationType,
            'location_id'     => $locationId,
            'parent_id'       => $parentId,
            'name_normalized' => $normalized,
        ]);
    }
}
