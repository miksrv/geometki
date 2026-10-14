<?php

namespace App\Models;

use App\Entities\UserNotificationEntity;

/**
 * Model for the `users_notifications` table.
 *
 * Manages in-app notifications for users. created_at is filled by the column default —
 * CI4 timestamps are off because there is no updatedField column on this table.
 *
 * Toast-only types (TOAST_ONLY_TYPES) live just long enough to be shown as a toast: they never
 * appear in the notification list or the unread badge, and notifications:prune deletes them.
 *
 * user_id and activity_id are hidden from output via $hiddenFields.
 *
 * @package App\Models
 */
class UsersNotificationsModel extends ApplicationBaseModel
{
    /** Notification types shown only as a toast: "+N XP" after the user's own action. */
    public const TOAST_ONLY_TYPES = ['experience'];

    /** How long a new notification is shown as a toast (GET /notifications/updates). */
    public const TOAST_WINDOW_MINUTES = 15;

    protected $table            = 'users_notifications';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = UserNotificationEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected array $hiddenFields = ['user_id', 'activity_id'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'type',
        'read',
        'meta',
        'user_id',
        'activity_id',
        'created_at',
    ];

    // No updatedField column exists on this table; created_at has a column default.
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
     * Unread notifications of the toast window (the last TOAST_WINDOW_MINUTES), newest first,
     * joined with the related activity row. Toast-only types are included.
     *
     * @param string $userId
     * @param int    $limit
     * @return array<int, object>
     */
    public function getRecentUnread(string $userId, int $limit = 10): array
    {
        return $this
            ->select('users_notifications.*, activity.type as activity_type, activity.place_id, activity.collection_id')
            ->join('activity', 'activity.id = users_notifications.activity_id', 'left')
            ->where('users_notifications.user_id', $userId)
            ->where('users_notifications.read', false)
            ->where('users_notifications.created_at >= DATE_SUB(NOW(), INTERVAL ' . self::TOAST_WINDOW_MINUTES . ' MINUTE)')
            ->orderBy('users_notifications.created_at', 'DESC')
            ->orderBy('users_notifications.id', 'DESC')
            ->findAll($limit);
    }

    /**
     * Count the user's unread notifications shown in the list (the bell badge).
     *
     * @param string $userId
     * @return int
     */
    public function countUnread(string $userId): int
    {
        return $this
            ->where('user_id', $userId)
            ->where('read', false)
            ->whereNotIn('type', self::TOAST_ONLY_TYPES)
            ->countAllResults();
    }

    /**
     * A page of the user's notification list, newest first, joined with activity. Toast-only
     * types are left out. Keyset pagination: pass the id of the last notification of the
     * previous page as $cursor, so notifications that arrive meanwhile do not shift the pages.
     *
     * @param string      $userId
     * @param int         $limit
     * @param string|null $cursor
     * @return array<int, object>
     */
    public function getPageByUser(string $userId, int $limit, ?string $cursor = null): array
    {
        $cursorRow = null;

        if ($cursor) {
            $cursorRow = $this->db->table($this->table)
                ->select('created_at')
                ->where('id', $cursor)
                ->where('user_id', $userId)
                ->get()
                ->getRow();

            // The cursor notification is gone (the list was cleared): nothing comes after it
            if (!$cursorRow) {
                return [];
            }
        }

        $builder = $this
            ->select('users_notifications.*, activity.type as activity_type, activity.place_id, activity.collection_id')
            ->join('activity', 'activity.id = users_notifications.activity_id', 'left')
            ->where('users_notifications.user_id', $userId)
            ->whereNotIn('users_notifications.type', self::TOAST_ONLY_TYPES);

        if ($cursorRow) {
            $builder
                ->groupStart()
                    ->where('users_notifications.created_at <', $cursorRow->created_at)
                    ->orGroupStart()
                        ->where('users_notifications.created_at', $cursorRow->created_at)
                        ->where('users_notifications.id <', $cursor)
                    ->groupEnd()
                ->groupEnd();
        }

        return $builder
            ->orderBy('users_notifications.created_at', 'DESC')
            ->orderBy('users_notifications.id', 'DESC')
            ->findAll($limit);
    }

    /**
     * Count the user's notifications shown in the list.
     *
     * @param string $userId
     * @return int
     */
    public function countByUser(string $userId): int
    {
        return $this
            ->where('user_id', $userId)
            ->whereNotIn('type', self::TOAST_ONLY_TYPES)
            ->countAllResults();
    }

    /**
     * Mark the given notifications of a user as read, or all of them when $ids is null.
     *
     * @param string                  $userId
     * @param array<int, string>|null $ids
     * @return void
     */
    public function markRead(string $userId, ?array $ids = null): void
    {
        if ($ids !== null && empty($ids)) {
            return;
        }

        $this->set('read', true)
            ->where('read', false)
            ->where('user_id', $userId);

        if ($ids !== null) {
            $this->whereIn('id', $ids);
        }

        $this->update();
    }

    /**
     * Delete notifications nobody needs any more: toast-only ones past the toast window
     * (whether shown or not), and read ones older than $readDays. Unread notifications of
     * other types are kept.
     *
     * @param int $readDays
     * @param int $batch    Rows per DELETE, to keep locks short on a big table
     * @return int Number of deleted rows
     */
    public function deleteStale(int $readDays, int $batch = 5000): int
    {
        $toastOnly = implode(',', array_map(fn ($type) => $this->db->escape($type), self::TOAST_ONLY_TYPES));
        $table     = $this->db->prefixTable($this->table);
        $total     = 0;

        foreach ([
            "type IN ($toastOnly) AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)",
            '`read` = 1 AND created_at < DATE_SUB(NOW(), INTERVAL ' . max(1, $readDays) . ' DAY)',
        ] as $condition) {
            do {
                $this->db->query("DELETE FROM {$table} WHERE $condition LIMIT " . max(1, $batch));

                $deleted = $this->db->affectedRows();
                $total  += $deleted;
            } while ($deleted >= $batch);
        }

        return $total;
    }
}
