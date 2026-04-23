<?php

namespace App\Models;

use App\Entities\LocationRegionEntity;

/**
 * Model for the `location_regions` table.
 *
 * Reference table of regions (states/provinces) used to tag places.
 * Soft-deletion is enabled. Timestamp fields are hidden from output.
 *
 * @package App\Models
 */
class LocationRegionsModel extends ApplicationBaseModel
{
    protected $table            = 'location_regions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = LocationRegionEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected array $hiddenFields = ['created_at', 'updated_at', 'deleted_at'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'country_id',
        'title_en',
        'title_ru',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules = [
        'title_en' => 'required|string|max_length[100]',
        'title_ru' => 'required|string|max_length[100]',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = false;

    protected $allowCallbacks = true;
    protected $afterFind      = ['prepareOutput'];
}
