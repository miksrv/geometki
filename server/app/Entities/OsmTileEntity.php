<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class OsmTileEntity extends Entity {
    protected $attributes = [
        'id'               => null,
        'tile_lat'         => null,
        'tile_lon'         => null,
        'status'           => 'queued',
        'priority'         => 0,
        'attempts'         => 0,
        'last_error'       => null,
        'candidates_count' => 0,
        'requested_at'     => null,
        'fetched_at'       => null,
        'next_fetch_at'    => null,
        'locked_at'        => null,
    ];

    protected $dates = [
        'requested_at',
        'fetched_at',
        'next_fetch_at',
        'locked_at',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'id'               => 'integer',
        'tile_lat'         => 'integer',
        'tile_lon'         => 'integer',
        'status'           => 'string',
        'priority'         => 'integer',
        'attempts'         => 'integer',
        'last_error'       => '?string',
        'candidates_count' => 'integer',
    ];
}
