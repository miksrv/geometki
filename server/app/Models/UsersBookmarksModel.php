<?php

namespace App\Models;

use App\Entities\UserBookmarkEntity;

/**
 * Model for the `users_bookmarks` table.
 *
 * Tracks places that users have saved as bookmarks. No soft-deletion —
 * bookmarks are created and deleted directly.
 *
 * @package App\Models
 */
class UsersBookmarksModel extends ApplicationBaseModel
{
    protected $table            = 'users_bookmarks';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = UserBookmarkEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
        'place_id',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
}
