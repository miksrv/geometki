<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class LocationCountryEntity extends Entity {
    protected $attributes = [
        'id'       => null,
        'osm_type' => null,
        'osm_id'   => null,
        'iso_code' => null,
        'title_en' => null,
        'title_ru' => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'id'       => 'integer',
        'osm_type' => '?string',
        'osm_id'   => '?integer',
        'iso_code' => '?string',
        'title_en' => 'string',
        'title_ru' => 'string',
    ];
}
