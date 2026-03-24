<?php

namespace App\Models;

class ActivityModel extends ApplicationBaseModel {
    protected $table            = 'activity';
    protected $primaryKey       = 'id';
    protected $returnType       = \App\Entities\ActivityEntity::class;
    protected $useAutoIncrement = false;
    protected $useSoftDeletes   = true;

    protected $allowedFields = [
        'type',
        'views',
        'session_id',
        'user_id',
        'photo_id',
        'place_id',
        'comment_id',
        'rating_id',
        'created_at'
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules      = [];
    protected $validationMessages   = [];
    protected $skipValidation       = true;
    protected $cleanValidationRules = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
    protected $afterInsert    = [];
    protected $beforeUpdate   = [];
    protected $afterUpdate    = [];
    protected $beforeFind     = [];
    protected $afterFind      = []; // ['prepareOutput'];
    protected $beforeDelete   = [];
    protected $afterDelete    = [];

    /**
     * Get unique editors for a specific place, excluding a specific user.
     *
     * @param string $placeId The ID of the place.
     * @param string $excludeUserId The user ID to exclude from the results.
     * @return array List of unique editors with their id, name, and avatar.
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
     * Get activity list with optional filters and pagination.
     *
     * @param string|null $lastDate Filter activities created before this date.
     * @param string|null $userId Filter activities by user ID.
     * @param string|null $placeId Filter activities by place ID.
     * @param int $limit Number of records to return (max 100).
     * @param int $offset Number of records to skip.
     * @return array List of activities with related data.
     */
    public function getActivityList(
        string $lastDate = null,
        string $userId = null,
        string $placeId = null,
        int $limit = 20,
        int $offset = 0
    ): array {
        $model = $this->select(
            'activity.*, places.id as place_id, places.category, users.id as user_id, users.name as user_name,
            users.avatar as user_avatar, photos.filename, photos.extension, photos.width, photos.height, rating.value, comments.content as comment_text')
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

        return $model->whereIn('activity.type', ['photo','place','rating','edit','comment'])
            ->orderBy('activity.created_at, activity.type', 'DESC')
            ->findAll(min(abs($limit), 100), abs($offset));
    }

    /**
     * Increment view counter for a set of activity IDs.
     *
     * @param array $ids List of activity IDs to increment views for.
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
     * Get next activity items for a specific user and place after a given date.
     *
     * @param array $activityIds List of activity IDs to exclude.
     * @param string $createdAt Date to filter activities created after this date.
     * @param string $userId User ID to filter activities.
     * @param string $placeId Place ID to filter activities.
     * @param int $limit Number of records to return (default 15).
     * @return array List of next activity items with related data.
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
            users.avatar as user_avatar, photos.filename, photos.extension, photos.width, photos.height')
            ->join('places', 'activity.place_id = places.id', 'left')
            ->join('photos', 'activity.photo_id = photos.id', 'left')
            ->join('users', 'activity.user_id = users.id', 'left')
            ->whereNotIn('activity.id', $activityIds)
            ->where('activity.created_at >=', $createdAt)
            ->where('activity.user_id', $userId)
            ->where('activity.place_id', $placeId)
            ->orderBy('activity.created_at', 'ASC')
            ->findAll($limit);
    }
}
