<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class UserVisitedPlaceEntity extends Entity {
    protected $attributes = [
        'user_id'    => null,
        'place_id'   => null,
        'visited_at' => null,
        'verified'   => null,
        'lat'        => null,
        'lon'        => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
        'visited_at',
    ];

    protected $casts = [
        'user_id'  => 'string',
        'place_id' => 'integer',
        'verified' => 'boolean',
        'lat'      => '?float',
        'lon'      => '?float',
    ];
}
