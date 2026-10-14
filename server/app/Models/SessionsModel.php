<?php

namespace App\Models;

use App\Entities\SessionEntity;
use CodeIgniter\Model;

/**
 * Model for the `sessions` table.
 *
 * Tracks anonymous and authenticated visitor sessions and their last known IP
 * address. String PK (32 hex chars). No soft-deletion: stale anonymous sessions
 * are removed by `php spark sessions:prune`.
 *
 * @package App\Models
 */
class SessionsModel extends Model
{
    protected $table            = 'sessions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = SessionEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'id',
        'user_id',
        'user_ip',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = false;
}
