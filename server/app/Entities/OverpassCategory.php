<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class OverpassCategory extends Entity {
    protected $attributes = [
        'id'           => null,
        'category'     => null,
        'subcategory'  => null,
        'name'         => null,
        'title'        => null,
        'category_map' => null,
    ];

    protected $casts = [
        'id'           => 'integer',
        'category'     => 'string',
        'subcategory'  => 'string',
        'name'         => 'string',
        'title'        => 'string',
        'category_map' => 'string',
    ];
}
