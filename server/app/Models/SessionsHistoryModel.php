<?php

namespace App\Models;

/**
 * Model for the `sessions_history` table.
 *
 * Records a time-series of geographic positions for each session.
 * No soft-deletion and no updatedField — rows are append-only.
 * Returns plain arrays since no entity is needed for this simple structure.
 *
 * @package App\Models
 */
class SessionsHistoryModel extends ApplicationBaseModel
{
    protected $table            = 'sessions_history';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'session_id',
        'lat',
        'lon',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';

    // updatedField and deletedField are not set — rows are never updated or soft-deleted.

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
}
