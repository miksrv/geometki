<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class CollectionPlaceEntity extends Entity {
    protected $attributes = [
        'collection_id' => null,
        'place_id'      => null,
        'position'      => 0,
        'note'          => null,
        'user_id'       => null,
    ];

    protected $dates = [
        'created_at',
    ];

    protected $casts = [
        'collection_id' => 'string',
        'place_id'      => 'string',
        'position'      => 'integer',
        'note'          => '?string',
        'user_id'       => '?string',
    ];
}
