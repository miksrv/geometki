<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class AchievementEntity extends Entity
{
    protected $attributes = [
        'id'             => null,
        'group_slug'     => null,
        'type'           => 'base',
        'tier'           => 'none',
        'category'       => null,
        'title_en'       => null,
        'title_ru'       => null,
        'description_en' => null,
        'description_ru' => null,
        'icon'           => null,
        'image'          => null,
        'rules'          => null,
        'season_start'   => null,
        'season_end'     => null,
        'xp_bonus'       => 0,
        'sort_order'     => 0,
        'is_active'      => 1,
    ];

    protected $dates = ['created_at', 'updated_at'];

    protected $casts = [
        'xp_bonus'   => 'integer',
        'sort_order' => 'integer',
        'is_active'  => 'boolean',
        'rules'      => 'json-array',
    ];
}
