<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class CollectionEntity extends Entity {
    protected $attributes = [
        'id'                => null,
        'slug'              => null,
        'user_id'           => null,
        'title'             => null,
        'description'       => null,
        'title_en'          => null,
        'description_en'    => null,
        'region_id'         => null,
        'country_id'        => null,
        'cover_place_id'    => null,
        'cover_photo_id'    => null,
        'hidden'            => 0,
        'featured'          => 0,
        'indexable'         => 0,
        'places_count'      => 0,
        'views'             => 0,
        'saves'             => 0,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'id'                => 'string',
        'slug'              => '?string',
        'user_id'           => 'string',
        'title'             => 'string',
        'description'       => '?string',
        'title_en'          => '?string',
        'description_en'    => '?string',
        'region_id'         => '?integer',
        'country_id'        => '?integer',
        'cover_place_id'    => '?string',
        'cover_photo_id'    => '?string',
        'hidden'            => 'integer',
        'featured'          => 'integer',
        'indexable'         => 'integer',
        'places_count'      => 'integer',
        'views'             => 'integer',
        'saves'             => 'integer',
    ];
}
