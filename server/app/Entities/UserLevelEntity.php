<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class UserLevelEntity extends Entity {
    protected $attributes = [
        'id'         => null,
        'title_en'   => null,
        'title_ru'   => null,
        'level'      => null,
        'experience' => null,
    ];

    protected $casts = [
        'id'         => 'integer',
        'title_en'   => 'string',
        'title_ru'   => 'string',
        'level'      => 'integer',
        'experience' => 'integer',
    ];
}
