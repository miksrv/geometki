<?php

namespace App\Models;

use App\Entities\UserAchievementEntity;

/**
 * Model for the `users_achievements` table.
 *
 * Tracks which achievements a user has earned, their progress toward
 * multi-tier achievements, and notification / email flags.
 * No soft-deletion and no timestamps — rows are either present or absent.
 *
 * @package App\Models
 */
class UsersAchievementsModel extends ApplicationBaseModel
{
    protected $table            = 'users_achievements';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = UserAchievementEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
        'achievement_id',
        'earned_at',
        'progress',
        'notified',
        'emailed',
    ];

    protected $useTimestamps = false;

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
}
