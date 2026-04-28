<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class ActivityEntity extends Entity {
    protected $attributes = [
        'type'       => null,
        'views'      => 0,
        'session_id' => null,
        'user_id'    => null,
        'photo_id'   => null,
        'place_id'   => null,
        'rating_id'  => null,
        'comment_id' => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'type'       => 'string',
        'views'      => 'integer',
        'session_id' => 'string',
        'user_id'    => 'string',
        'photo_id'   => 'string',
        'place_id'   => 'string',
        'rating_id'  => 'string',
        'comment_id' => 'string',
    ];
}
