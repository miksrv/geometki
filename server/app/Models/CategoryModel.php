<?php

namespace App\Models;

use App\Entities\CategoryEntity;
use CodeIgniter\Model;

/**
 * Model for the `category` table.
 *
 * Categories are managed directly in the database and are read-only through
 * the API. $allowedFields is intentionally empty to prevent mass-assignment.
 * No timestamps are tracked.
 *
 * @package App\Models
 */
class CategoryModel extends Model
{
    protected $table            = 'category';
    protected $primaryKey       = 'name';
    protected $useAutoIncrement = false;
    protected $returnType       = CategoryEntity::class;
    protected $useSoftDeletes   = false;

    /**
     * Intentionally empty — categories are not created or updated via the API.
     *
     * @var array<int, string>
     */
    protected $allowedFields = [];

    protected $useTimestamps = false;

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = false;
}
