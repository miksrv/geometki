<?php

namespace App\Models;

use App\Entities\ActivityEntity;

/**
 * Model for the `activity` table.
 *
 * The log of user actions (place creation, edits, photos, ratings, comments,
 * visits, bookmarks, collections): the source of XP, achievements, notifications,
 * the weekly digest and the place history. The public feed is built from it at
 * write time (App\Libraries\FeedLibrary, `feed_id` is the story a row belongs to).
 * Supports soft-deletion.
 *
 * @package App\Models
 */
class ActivityModel extends ApplicationBaseModel
{
    protected $table            = 'activity';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = ActivityEntity::class;
    protected $useSoftDeletes   = true;

    /**
     * `feed_id` is not here on purpose: FeedLibrary sets it with its own query, so writing
     * an action never depends on the feed schema (the API is deployed before its migration).
     *
     * @var array<int, string>
     */
    protected $allowedFields = [
        'type',
        'session_id',
        'user_id',
        'photo_id',
        'place_id',
        'comment_id',
        'rating_id',
        'collection_id',
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

    // -------------------------------------------------------------------------
    // Custom query methods
    // -------------------------------------------------------------------------

    /**
     * Get unique editors for a specific place, excluding a given user.
     *
     * @param string $placeId       The ID of the place.
     * @param string $excludeUserId The user ID to exclude from the results.
     * @return array<int, object>
     */
    public function gePlaceEditors(string $placeId, string $excludeUserId): array
    {
        return $this
            ->select('users.id as id, users.name, users.avatar')
            ->join('users', 'activity.user_id = users.id', 'left')
            ->where(['place_id' => $placeId, 'user_id !=' => $excludeUserId])
            ->whereIn('type', ['edit', 'cover', 'photo'])
            ->groupBy('user_id')
            ->findAll();
    }

    /**
     * Whether a 'collection' (created) activity has already been recorded
     * for the given collection. Used to fire that activity only once, when
     * the collection first reaches the minimum place count.
     *
     * @param string $collectionId
     * @return bool
     */
    public function hasCollectionActivity(string $collectionId): bool
    {
        return (bool) $this
            ->where(['type' => 'collection', 'collection_id' => $collectionId])
            ->countAllResults();
    }
}
