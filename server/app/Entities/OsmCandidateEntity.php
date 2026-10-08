<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class OsmCandidateEntity extends Entity {
    protected $attributes = [
        'id'                  => null,
        'source'              => 'osm',
        'osm_type'            => null,
        'osm_id'              => null,
        'tile_id'             => null,
        'lat'                 => null,
        'lon'                 => null,
        'size_m'              => null,
        'name'                => null,
        'osm_tag'             => null,
        'category'            => null,
        'tags'                => null,
        'wikipedia'           => null,
        'wikidata'            => null,
        'wiki_source'         => null,
        'wiki_distance'       => null,
        'sitelinks'           => null,
        'heritage'            => null,
        'photos'              => null,
        'settlement_name'     => null,
        'settlement_type'     => null,
        'settlement_distance' => null,
        'score_breakdown'     => null,
        'score'               => 0,
        'tier'                => 'other',
        'status'              => 'open',
        'place_id'            => null,
        'linked_by'           => null,
        'linked_at'           => null,
        'seen_at'             => null,
    ];

    protected $dates = [
        'linked_at',
        'seen_at',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'id'                  => 'string',
        'source'              => 'string',
        'osm_type'            => '?string',
        'osm_id'              => '?integer',
        'tile_id'             => 'integer',
        'lat'                 => 'float',
        'lon'                 => 'float',
        'size_m'              => '?integer',
        'name'                => '?string',
        'osm_tag'             => 'string',
        'category'            => '?string',
        'tags'                => 'json-array',
        'wikipedia'           => '?string',
        'wikidata'            => '?string',
        'wiki_source'         => '?string',
        'wiki_distance'       => '?integer',
        'sitelinks'           => '?integer',
        'heritage'            => '?string',
        'photos'              => '?json-array',
        'settlement_name'     => '?string',
        'settlement_type'     => '?string',
        'settlement_distance' => '?integer',
        'score_breakdown'     => '?json-array',
        'score'               => 'integer',
        'tier'                => 'string',
        'status'              => 'string',
        'place_id'            => '?string',
        'linked_by'           => '?string',
    ];
}
