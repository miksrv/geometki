<?php

namespace App\Models;

use App\Entities\AchievementEntity;

/**
 * Model for the `achievements` table.
 *
 * Provides read and write access to the achievement definition catalogue.
 * No soft-deletion — achievements are deactivated via the is_active flag.
 *
 * @package App\Models
 */
class AchievementsModel extends ApplicationBaseModel
{
    protected $table            = 'achievements';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = AchievementEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
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
