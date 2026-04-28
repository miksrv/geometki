<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class UserBookmarkEntity extends Entity {
    protected $attributes = [
        'user_id'  => null,
        'place_id' => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'user_id'  => 'string',
        'place_id' => 'string',
    ];
}
