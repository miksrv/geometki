<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class LocationCountryEntity extends Entity {
    protected $attributes = [
        'id'       => null,
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
        'title_en' => 'string',
        'title_ru' => 'string',
    ];
}
