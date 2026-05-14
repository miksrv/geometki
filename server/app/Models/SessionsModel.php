<?php

namespace App\Models;

use App\Entities\SessionEntity;
use CodeIgniter\Model;

/**
 * Model for the `sessions` table.
 *
 * Tracks anonymous and authenticated visitor sessions, including their last
 * known IP address and coordinates. Auto-increment integer PK.
 * No soft-deletion — sessions are either active or removed.
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
        'lat',
        'lon',
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
