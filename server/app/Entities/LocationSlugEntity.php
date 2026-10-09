<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class LocationSlugEntity extends Entity {
    protected $attributes = [
        'id'         => null,
        'slug'       => null,
        'type'       => null,
        'entity_id'  => null,
        'is_primary' => 0,
    ];

    protected $dates = [
        'created_at',
    ];

    protected $casts = [
        'id'         => 'integer',
        'slug'       => 'string',
        'type'       => 'string',
        'entity_id'  => 'integer',
        'is_primary' => 'boolean',
    ];
}
