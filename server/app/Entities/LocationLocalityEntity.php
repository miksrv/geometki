<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class LocationLocalityEntity extends Entity {
    protected $attributes = [
        'id'          => null,
        'country_id'  => null,
        'region_id'   => null,
        'district_id' => null,
        'title_en'    => null,
        'title_ru'    => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'id'          => 'integer',
        'country_id'  => 'integer',
        'region_id'   => 'integer',
        'district_id' => 'integer',
        'title_en'    => 'string',
        'title_ru'    => 'string',
    ];
}
