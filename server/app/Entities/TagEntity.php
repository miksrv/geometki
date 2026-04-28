<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class TagEntity extends Entity {
    protected $attributes = [
        'title_en' => null,
        'title_ru' => null,
        'count'    => 0,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'title_en' => 'string',
        'title_ru' => 'string',
        'count'    => 'integer',
    ];
}
