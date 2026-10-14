<?php namespace App\Libraries;

use App\Entities\UserNotificationEntity;
use App\Models\UsersNotificationsModel;
use ReflectionException;

class NotifyLibrary {
    /** The values of the users_notifications.type enum */
    public const TYPES = ['photo', 'place', 'rating', 'comment', 'edit', 'cover', 'experience', 'level', 'achievements', 'bookmark', 'visit', 'collection_place'];

    /**
     * Add an in-app notification. A type outside TYPES is logged and skipped instead of
     * failing the insert on the enum column.
     *
     * @param string $type One of TYPES
     * @param string $userId
     * @param string|null $activity
     * @param array|object|null $value
     * @throws ReflectionException
     */
    public function push(
        string $type,
        string $userId,
        string|null $activity = null,
        array|object|null $value = null
    ): void
    {
        if (!in_array($type, self::TYPES, true)) {
            log_message('warning', 'NotifyLibrary: unknown notification type "{type}"', ['type' => $type]);

            return;
        }

        $notification = new UserNotificationEntity();
        $notification->type        = $type;
        $notification->meta        = $value;
        $notification->user_id     = $userId;
        $notification->activity_id = $activity;

        $model = new UsersNotificationsModel();
        $model->insert($notification);
    }
}
