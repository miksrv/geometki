<?php

namespace App\Models;

use App\Entities\PlaceContentEntity;

/**
 * Model for the `places_content_revisions` table.
 *
 * Append-only log of every saved version of a place text, written by
 * PlacesContentModel::saveContent(). The site never reads it: it is there
 * to roll a text back (`php spark content:revert`).
 *
 * @package App\Models
 */
class PlacesContentRevisionsModel extends ApplicationBaseModel
{
    protected $table            = 'places_content_revisions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = PlaceContentEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'place_id',
        'user_id',
        'locale',
        'title',
        'content',
        'delta',
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

    /**
     * The newest revision of a place text in one locale, or null.
     */
    public function findLatest(string $placeId, string $locale): ?PlaceContentEntity
    {
        return $this
            ->where(['place_id' => $placeId, 'locale' => $locale])
            ->orderBy('created_at', 'DESC')
            ->orderBy('updated_at', 'DESC')
            ->first();
    }
}
