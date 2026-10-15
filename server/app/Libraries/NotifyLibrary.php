<?php namespace App\Libraries;

use App\Entities\UserNotificationEntity;
use App\Libraries\Push\PushQueue;
use App\Models\UsersNotificationsModel;
use ReflectionException;
use Throwable;

class NotifyLibrary {
    /** The values of the users_notifications.type enum */
    public const TYPES = ['photo', 'place', 'rating', 'comment', 'edit', 'cover', 'experience', 'level', 'achievements', 'bookmark', 'visit', 'collection_place'];

    /**
     * Add an in-app notification, and queue it as a push when its type is pushable
     * (PushQueue). A type outside TYPES is logged and skipped instead of failing the
     * insert on the enum column.
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

        // The same news as a push to the user's devices; it must not fail the action
        try {
            (new PushQueue())->queue($type, $userId, $activity, $value, $model->getLastGeneratedId());
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }
    }
}
