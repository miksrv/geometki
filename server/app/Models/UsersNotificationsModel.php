<?php

namespace App\Models;

use App\Entities\UserNotificationEntity;

/**
 * Model for the `users_notifications` table.
 *
 * Manages in-app notifications for users. No soft-deletion; notifications are
 * permanent. created_at is tracked manually — CI4 timestamps are off because
 * there is no updatedField column on this table.
 *
 * user_id, activity_id, and created_at are hidden from output via $hiddenFields.
 *
 * @package App\Models
 */
class UsersNotificationsModel extends ApplicationBaseModel
{
    protected $table            = 'users_notifications';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = UserNotificationEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected array $hiddenFields = ['user_id', 'activity_id', 'created_at'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'type',
        'read',
        'meta',
        'user_id',
        'activity_id',
        'created_at',
    ];

    // No updatedField column exists on this table; manage created_at manually.
    protected $useTimestamps = false;

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
     * Get recent unread notifications for a user (within the last 15 minutes),
     * joined with the related activity row.
     *
     * @param string $userId
     * @param int    $limit
     * @return array<int, object>
     */
    public function getRecentUnread(string $userId, int $limit = 10): array
    {
        return $this
            ->select('users_notifications.*, activity.type as activity_type, activity.place_id')
            ->join('activity', 'activity.id = users_notifications.activity_id', 'left')
            ->where('read', false)
            ->where('users_notifications.user_id', $userId)
            ->where('users_notifications.created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)')
            ->orderBy('read, created_at', 'DESC')
            ->findAll($limit);
    }

    /**
     * Count unread notifications older than 15 minutes for a user.
     *
     * @param string $userId
     * @return int
     */
    public function countOlderUnread(string $userId): int
    {
        return (int) $this
            ->select('id')
            ->where('read', false)
            ->where('users_notifications.user_id', $userId)
            ->where('users_notifications.created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)')
            ->countAllResults();
    }

    /**
     * Get a paginated list of all notifications for a user, joined with activity.
     *
     * @param string $userId
     * @param int    $limit
     * @param int    $offset
     * @return array<int, object>
     */
    public function getPaginatedByUser(string $userId, int $limit, int $offset): array
    {
        return $this
            ->select('users_notifications.*, activity.type as activity_type, activity.place_id')
            ->join('activity', 'activity.id = users_notifications.activity_id', 'left')
            ->where('users_notifications.user_id', $userId)
            ->orderBy('created_at', 'DESC')
            ->findAll(abs($limit), abs($offset));
    }

    /**
     * Count all notifications for a user.
     *
     * @param string $userId
     * @return int
     */
    public function countByUser(string $userId): int
    {
        return (int) $this
            ->select('id')
            ->where('users_notifications.user_id', $userId)
            ->countAllResults();
    }

    /**
     * Mark a set of notification IDs as read for a given user.
     *
     * @param string             $userId
     * @param array<int, string> $ids
     * @return void
     */
    public function markRead(string $userId, array $ids): void
    {
        if (empty($ids)) {
            return;
        }

        $this->set('read', true)
            ->where('read', false)
            ->where('users_notifications.user_id', $userId)
            ->whereIn('id', $ids)
            ->update();
    }
}
