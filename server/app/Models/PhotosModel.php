<?php

namespace App\Models;

use App\Entities\PhotoEntity;

/**
 * Model for the `photos` table.
 *
 * Manages photo metadata records attached to places. Soft-deletion is enabled.
 * updated_at and deleted_at are stripped from output via $hiddenFields.
 *
 * @package App\Models
 */
class PhotosModel extends ApplicationBaseModel
{
    protected $table            = 'photos';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = PhotoEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected array $hiddenFields = ['updated_at', 'deleted_at'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'place_id',
        'user_id',
        'lat',
        'lon',
        'title_en',
        'title_ru',
        'filename',
        'extension',
        'filesize',
        'width',
        'height',
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
