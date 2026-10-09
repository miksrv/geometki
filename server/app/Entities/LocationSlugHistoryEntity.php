<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class LocationSlugHistoryEntity extends Entity {
    protected $attributes = [
        'id'        => null,
        'old_slug'  => null,
        'type'      => null,
        'entity_id' => null,
    ];

    protected $dates = [
        'created_at',
    ];

    protected $casts = [
        'id'        => 'integer',
        'old_slug'  => 'string',
        'type'      => 'string',
        'entity_id' => 'integer',
    ];
}
