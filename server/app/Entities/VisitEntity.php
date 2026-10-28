<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class VisitEntity extends Entity {
    protected $attributes = [
        'user_id'    => null,
        'place_id'   => null,
        'visited_at' => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'visited_at',
    ];

    protected $casts = [
        'user_id'  => 'string',
        'place_id' => 'string',
    ];
}
