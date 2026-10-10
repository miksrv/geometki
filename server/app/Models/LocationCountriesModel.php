<?php

namespace App\Models;

use App\Entities\LocationCountryEntity;

/**
 * Model for the `location_countries` table.
 *
 * Reference table of countries used to tag places with geographic data.
 * Soft-deletion is enabled. Timestamp fields are hidden from output.
 *
 * @package App\Models
 */
class LocationCountriesModel extends ApplicationBaseModel
{
    protected $table            = 'location_countries';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = LocationCountryEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected array $hiddenFields = ['created_at', 'updated_at', 'deleted_at'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'osm_type',
        'osm_id',
        'iso_code',
        'title_en',
        'title_ru',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules = [
        'osm_type' => 'permit_empty|in_list[node,way,relation]',
        'osm_id'   => 'permit_empty|integer',
        'iso_code' => 'permit_empty|string|exact_length[2]',
        'title_en' => 'required|string|max_length[50]',
        'title_ru' => 'required|string|max_length[50]',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = false;

    protected $allowCallbacks = true;
    protected $afterFind      = ['prepareOutput'];
}
