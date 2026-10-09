<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class LocationLegacyIdEntity extends Entity {
    protected $attributes = [
        'id'            => null,
        'location_type' => null,
        'old_id'        => null,
        'new_id'        => null,
    ];

    protected $dates = [
        'created_at',
    ];

    protected $casts = [
        'id'            => 'integer',
        'location_type' => 'string',
        'old_id'        => 'integer',
        'new_id'        => 'integer',
    ];
}
