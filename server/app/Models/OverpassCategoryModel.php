<?php

namespace App\Models;

use App\Entities\OverpassCategory;
use CodeIgniter\Model;

/**
 * Model for the `overpass_category` table.
 *
 * Maps Overpass API tag combinations to internal place categories.
 * Used during POI import to normalise external category data.
 * No timestamps; reference data is seeded, not managed via the API.
 *
 * @package App\Models
 */
class OverpassCategoryModel extends Model
{
    protected $table            = 'overpass_category';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = OverpassCategory::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'category',
        'subcategory',
        'title',
        'category_map',
    ];

    protected $useTimestamps = false;

    protected $validationRules = [
        'category'    => 'required|alpha_numeric_space|max_length[50]',
        'subcategory' => 'required|alpha_numeric_space|max_length[50]',
        'title'       => 'permit_empty|string|max_length[50]',
        'category_map' => 'required|alpha_numeric_space|max_length[50]',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = false;
}
