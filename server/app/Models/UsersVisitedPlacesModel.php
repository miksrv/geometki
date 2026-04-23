<?php

namespace App\Models;

use App\Entities\UserVisitedPlaceEntity;

/**
 * Model for the `users_visited_places` table.
 *
 * Tracks which places a user has marked as visited. No soft-deletion —
 * visit records are created and deleted directly.
 *
 * @package App\Models
 */
class UsersVisitedPlacesModel extends ApplicationBaseModel
{
    protected $table            = 'users_visited_places';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = UserVisitedPlaceEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
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
}
