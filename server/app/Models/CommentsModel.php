<?php

namespace App\Models;

use App\Entities\CommentEntity;

/**
 * Model for the `comments` table.
 *
 * Manages user comments on places. Soft-deletion is enabled.
 * updated_at and deleted_at are stripped from output via $hiddenFields.
 *
 * @package App\Models
 */
class CommentsModel extends ApplicationBaseModel
{
    protected $table            = 'comments';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = CommentEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected array $hiddenFields = [
        'updated_at',
        'deleted_at',
    ];

    /** @var array<int, string> */
    protected $allowedFields = [
        'place_id',
        'user_id',
        'answer_id',
        'content',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
    protected $afterFind      = ['prepareOutput'];
}
