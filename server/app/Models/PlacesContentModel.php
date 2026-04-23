<?php

namespace App\Models;

use App\Entities\PlaceContentEntity;

/**
 * Model for the `places_content` table.
 *
 * Stores localised title and rich-text content revisions for places.
 * No soft-deletion — content rows are append-only (new revision per edit).
 *
 * @package App\Models
 */
class PlacesContentModel extends ApplicationBaseModel
{
    protected $table            = 'places_content';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = PlaceContentEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'place_id',
        'user_id',
        'locale',
        'title',
        'content',
        'delta',
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
}
