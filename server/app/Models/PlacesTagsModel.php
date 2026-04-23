<?php

namespace App\Models;

/**
 * Model for the `places_tags` pivot table.
 *
 * Manages many-to-many associations between places and tags.
 * No soft-deletion on this pivot — rows are inserted/deleted directly.
 * No entity class; returns plain stdClass objects.
 *
 * @package App\Models
 */
class PlacesTagsModel extends ApplicationBaseModel
{
    protected $table            = 'places_tags';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'object';
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'tag_id',
        'place_id',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    // -------------------------------------------------------------------------
    // Custom query methods
    // -------------------------------------------------------------------------

    /**
     * Get all tags for a place with their usage counts.
     *
     * @param string $placeId
     * @return array<int, object>
     */
    public function getPlaceTags(string $placeId): array
    {
        return $this
            ->select('tags.id as id, count')
            ->join('tags', 'places_tags.tag_id = tags.id', 'left')
            ->where('place_id', $placeId)
            ->findAll();
    }

    /**
     * Delete all tag associations for a given place.
     *
     * @param string $placeId
     * @return void
     */
    public function deleteByPlaceId(string $placeId): void
    {
        $this->where('place_id', $placeId)->delete();
    }

    /**
     * Get all pivot rows for a place, joined with the tags table.
     *
     * @param string $placeId
     * @return array<int, object>
     */
    public function getAllByPlaceId(string $placeId): array
    {
        return $this->join('tags', 'tags.id = places_tags.tag_id')
            ->where('place_id', $placeId)
            ->findAll();
    }
}
