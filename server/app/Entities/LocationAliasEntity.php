<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class LocationAliasEntity extends Entity {
    protected $attributes = [
        'id'              => null,
        'location_type'   => null,
        'location_id'     => null,
        'parent_id'       => 0,
        'name_normalized' => null,
    ];

    protected $dates = [
        'created_at',
    ];

    protected $casts = [
        'id'              => 'integer',
        'location_type'   => 'string',
        'location_id'     => 'integer',
        'parent_id'       => 'integer',
        'name_normalized' => 'string',
    ];
}
