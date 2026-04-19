<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class UserAchievementEntity extends Entity
{
    protected $attributes = [
        'id'             => null,
        'user_id'        => null,
        'achievement_id' => null,
        'earned_at'      => null,
        'progress'       => null,
        'notified'       => 0,
        'emailed'        => 0,
    ];

    protected $casts = [
        'notified' => 'integer',
        'emailed'  => 'integer',
        'progress' => 'json-array',
    ];
}
