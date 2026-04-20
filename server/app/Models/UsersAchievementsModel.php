<?php

namespace App\Models;

class UsersAchievementsModel extends ApplicationBaseModel
{
    protected $table            = 'users_achievements';
    protected $primaryKey       = 'id';
    protected $returnType       = \App\Entities\UserAchievementEntity::class;
    protected $useAutoIncrement = false;
    protected $useSoftDeletes   = false;

    protected $allowedFields = [
        'id',
        'user_id',
        'achievement_id',
        'earned_at',
        'progress',
        'notified',
        'emailed',
    ];

    protected $useTimestamps = false;

    protected $validationRules      = [];
    protected $validationMessages   = [];
    protected $skipValidation       = true;
    protected $cleanValidationRules = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
    protected $afterInsert    = [];
    protected $beforeUpdate   = [];
    protected $afterUpdate    = [];
    protected $beforeFind     = [];
    protected $afterFind      = [];
    protected $beforeDelete   = [];
    protected $afterDelete    = [];
}
