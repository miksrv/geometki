<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class PhotoEntity extends Entity {
    protected $attributes = [
        'place_id'  => null,
        'user_id'   => null,
        'lat'       => 0,
        'lon'       => 0,
        'title_en'  => null,
        'title_ru'  => null,
        'filename'  => null,
        'extension' => null,
        'filesize'  => 0,
        'width'     => 0,
        'height'    => 0,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'place_id'  => 'string',
        'user_id'   => 'string',
        'lat'       => 'float',
        'lon'       => 'float',
        'title_en'  => 'string',
        'title_ru'  => 'string',
        'filename'  => 'string',
        'extension' => 'string',
        'filesize'  => 'integer',
        'width'     => 'integer',
        'height'    => 'integer',
        'created'   => 'datetime',
    ];

    protected $datamap = [
        'created' => 'created_at',
    ];
}
