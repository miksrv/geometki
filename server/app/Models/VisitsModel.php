<?php

namespace App\Models;

use App\Entities\VisitEntity;

/**
 * Model for the `users_visited_places` table: the log of check-ins ("I was here").
 *
 * One row per visit; a person can have many at one place, one per day
 * (`Visits::create()` is idempotent per day). No soft-deletion: a deleted visit is gone,
 * its photos stay (`photos.visit_id` → NULL) and its `visit` activity is soft-deleted by
 * the controller.
 *
 * @package App\Models
 */
class VisitsModel extends ApplicationBaseModel
{
    protected $table            = 'users_visited_places';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = VisitEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
        'place_id',
        'visited_at',
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

    /**
     * The user's visit of the place on that day, if any.
     *
     * @param string $day `Y-m-d`
     */
    public function findByDay(string $userId, string $placeId, string $day): ?VisitEntity
    {
        return $this
            ->where(['user_id' => $userId, 'place_id' => $placeId])
            ->where('DATE(visited_at)', $day)
            ->first();
    }
}
