<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class RatingEntity extends Entity {
    protected $attributes = [
        'place_id'   => null,
        'user_id'    => null,
        'session_id' => null,
        'rating'     => null,
        'value'      => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'place_id'   => 'string',
        'user_id'    => 'string',
        'session_id' => 'string',
        'rating'     => 'string',
        'value'      => 'integer',
        'created'    => 'datetime',
    ];

    protected $datamap = [
        'created' => 'created_at',
    ];
}
