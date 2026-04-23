<?php

namespace App\Models;

use App\Entities\UserLevelEntity;
use CodeIgniter\Model;

/**
 * Model for the `users_levels` table.
 *
 * Read-only reference table that maps level numbers to titles and XP
 * thresholds. The PK is the level number itself (not auto-increment).
 * No timestamps; data is seeded, not managed via the API.
 *
 * @package App\Models
 */
class UsersLevelsModel extends Model
{
    protected $table            = 'users_levels';
    protected $primaryKey       = 'level';
    protected $useAutoIncrement = false;
    protected $returnType       = UserLevelEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'title_en',
        'title_ru',
        'experience',
    ];

    protected $useTimestamps = false;

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = false;
}
