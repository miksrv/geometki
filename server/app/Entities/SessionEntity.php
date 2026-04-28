<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class SessionEntity extends Entity {
    protected $attributes = [
        'id'      => null,
        'user_id' => null,
        'user_ip' => null,
        'lat'     => null,
        'lon'     => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'id'      => 'string',
        'user_id' => 'string',
        'user_ip' => 'string',
        'lat'     => 'float',
        'lon'     => 'float',
    ];
}
