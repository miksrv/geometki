<?php

namespace App\Models;

use App\Entities\ActivityEntity;

/**
 * Model for the `activity` table.
 *
 * Records user-generated events (place creation, edits, photos, ratings,
 * comments). Supports soft-deletion and provides methods for listing,
 * filtering, and incrementing view counters.
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

    /** @var array<int, string> */
    protected $allowedFields = [
        'type',
        'views',
        'session_id',
        'user_id',
        'photo_id',
        'place_id',
        'comment_id',
        'rating_id',
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
     * Get an activity list with optional filters and cursor-based pagination.
     *
     * @param string|null $lastDate  Return activities created before this datetime.
     * @param string|null $userId   Filter by user ID.
     * @param string|null $placeId  Filter by place ID.
     * @param int         $limit    Records to return (capped at 100).
     * @param int         $offset   Records to skip.
     * @return array<int, object>
     */
    public function getActivityList(
        ?string $lastDate = null,
        ?string $userId = null,
        ?string $placeId = null,
        int $limit = 20,
        int $offset = 0
    ): array {
        $model = $this->select(
            'activity.*, places.id as place_id, places.category, users.id as user_id, users.name as user_name,
            users.avatar as user_avatar, photos.filename, photos.extension, photos.width, photos.height, rating.value, comments.content as comment_text'
        )
            ->join('places', 'activity.place_id = places.id', 'left')
            ->join('photos', 'activity.photo_id = photos.id', 'left')
            ->join('users', 'activity.user_id = users.id', 'left')
            ->join('rating', 'activity.rating_id = rating.id', 'left')
            ->join('comments', 'activity.comment_id = comments.id', 'left');

        if ($lastDate) {
            $model->where('activity.created_at < ', $lastDate);
        }

        if ($userId) {
            $model->where('activity.user_id', $userId);
        }

        if ($placeId) {
            $model->where('activity.place_id', $placeId);
        }

//        return $model->whereIn('activity.type', ['photo', 'place', 'rating', 'edit', 'comment', 'cover'])
        return $model
            ->orderBy('activity.created_at', 'DESC')
            ->orderBy('activity.type', 'DESC')
            ->findAll(min(abs($limit), 100), abs($offset));
    }

    /**
     * Increment the view counter for a set of activity IDs.
     *
     * @param array<int, string> $ids  List of activity IDs to increment.
     * @return void
     */
    public function incrementViews(array $ids): void
    {
        if (empty($ids)) {
            return;
        }

        $this->set('views', 'views + 1', false)
            ->whereIn('id', $ids)
            ->update();
    }

    /**
     * Get the next activity items for a specific user and place after a given date,
     * excluding already-loaded IDs.
     *
     * @param array<int, string> $activityIds  Activity IDs to exclude.
     * @param string             $createdAt    Return activities created on or after this datetime.
     * @param string             $userId       Filter by user ID.
     * @param string             $placeId      Filter by place ID.
     * @param int                $limit        Records to return (default 15).
     * @return array<int, object>
     */
    public function getNextActivityItems(
        array $activityIds,
        string $createdAt,
        string $userId,
        string $placeId,
        int $limit = 15
    ): array {
        return $this->select(
            'activity.*, places.id as place_id, places.category, users.id as user_id, users.name as user_name,
            users.avatar as user_avatar, photos.filename, photos.extension, photos.width, photos.height,
            rating.value, comments.content as comment_text'
        )
            ->join('places', 'activity.place_id = places.id', 'left')
            ->join('photos', 'activity.photo_id = photos.id', 'left')
            ->join('users', 'activity.user_id = users.id', 'left')
            ->join('rating', 'activity.rating_id = rating.id', 'left')
            ->join('comments', 'activity.comment_id = comments.id', 'left')
            ->whereNotIn('activity.id', $activityIds)
            ->where('activity.created_at >=', $createdAt)
            ->where('activity.user_id', $userId)
            ->where('activity.place_id', $placeId)
            ->orderBy('activity.created_at', 'ASC')
            ->findAll($limit);
    }
}
