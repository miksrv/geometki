<?php namespace App\Libraries;

use App\Entities\UserNotificationEntity;
use App\Models\UsersNotificationsModel;
use ReflectionException;

class NotifyLibrary {
    protected array $types = ['photo', 'place', 'rating', 'comment', 'edit', 'cover', 'experience', 'level', 'achievements', 'bookmark', 'visit'];

    /**
     * @param string $type One of: 'photo', 'place', 'rating', 'comment', 'edit', 'cover', 'experience', 'level', 'achievements', 'bookmark', 'visit'
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
        $notification = new UserNotificationEntity();
        $notification->type        = $type;
        $notification->meta        = $value ?? '';
        $notification->user_id     = $userId;
        $notification->activity_id = $activity;

        $model = new UsersNotificationsModel();
        $model->insert($notification);
    }
}
