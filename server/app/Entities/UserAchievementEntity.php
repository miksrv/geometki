<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class UserAchievementEntity extends Entity {
    protected $attributes = [
        'id'             => null,
        'user_id'        => null,
        'achievement_id' => null,
        'earned_at'      => null,
        'progress'       => null,
        'notified'       => 0,
        'emailed'        => 0,
    ];

    protected $dates = ['earned_at'];

    protected $casts = [
        'id'             => 'string',
        'user_id'        => 'string',
        'achievement_id' => 'string',
        'notified'       => 'integer',
        'emailed'        => 'integer',
        'progress'       => 'json-array',
    ];
}
