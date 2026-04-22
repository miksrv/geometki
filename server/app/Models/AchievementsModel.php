<?php

namespace App\Models;

class AchievementsModel extends ApplicationBaseModel
{
    protected $table            = 'achievements';
    protected $primaryKey       = 'id';
    protected $returnType       = \App\Entities\AchievementEntity::class;
    protected $useAutoIncrement = false;
    protected $useSoftDeletes   = false;

    protected $allowedFields = [
        'id',
        'group_slug',
        'type',
        'tier',
        'category',
        'title_en',
        'title_ru',
        'description_en',
        'description_ru',
        'image',
        'rules',
        'season_start',
        'season_end',
        'xp_bonus',
        'sort_order',
        'is_active',
        'created_at',
        'updated_at',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

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
