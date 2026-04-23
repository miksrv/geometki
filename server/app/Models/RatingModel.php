<?php

namespace App\Models;

use App\Entities\RatingEntity;

/**
 * Model for the `rating` table.
 *
 * Stores per-user (or per-session) rating values for places.
 * Soft-deletion is enabled so that rating history is preserved.
 *
 * @package App\Models
 */
class RatingModel extends ApplicationBaseModel
{
    protected $table            = 'rating';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = RatingEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected $allowedFields = [
        'place_id',
        'user_id',
        'session_id',
        'value',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
}
