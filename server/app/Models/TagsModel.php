<?php

namespace App\Models;

use App\Entities\TagEntity;

/**
 * Model for the `tags` table.
 *
 * Manages user-defined tags that can be attached to places. No soft-deletion —
 * tags are kept forever to preserve history. created_at is hidden from output.
 *
 * @package App\Models
 */
class TagsModel extends ApplicationBaseModel
{
    protected $table            = 'tags';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = TagEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected array $hiddenFields = ['created_at'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'title_en',
        'title_ru',
        'count',
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
    protected $afterFind      = ['prepareOutput'];

    // -------------------------------------------------------------------------
    // Custom query methods
    // -------------------------------------------------------------------------

    /**
     * Find a tag matching the given title in either the Russian or English
     * column, returning its ID and usage count.
     *
     * @param string $title  Tag title to search for.
     * @return object|array|null
     */
    public function getTagsByTitle(string $title): object|array|null
    {
        return $this
            ->select('id, count')
            ->where('title_ru', $title)
            ->orWhere('title_en', $title)
            ->first();
    }
}
