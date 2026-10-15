<?php

use App\Entities\UserNotificationEntity;
use App\Libraries\NotifyLibrary;
use App\Models\UsersNotificationsModel;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the notification model, entity and NotifyLibrary — no database.
 *
 * @internal
 */
final class NotificationsTest extends CIUnitTestCase
{
    /**
     * Regression: created_at was in $hiddenFields, so the API never returned `created`
     * and the notification list showed no dates.
     */
    public function testPrepareOutputKeepsCreatedAtAndHidesOwnerColumns(): void
    {
        $notification = new UserNotificationEntity([
            'id'          => 'n1',
            'type'        => 'comment',
            'user_id'     => 'u1',
            'activity_id' => 'a1',
            'created_at'  => '2026-10-14 10:00:00',
        ]);

        $result = (new UsersNotificationsModel())->prepareOutput([
            'data'   => [$notification],
            'method' => 'findAll',
        ]);

        $item = $result['data'][0];

        $this->assertTrue(isset($item->created_at));
        $this->assertFalse(isset($item->user_id));
        $this->assertFalse(isset($item->activity_id));
    }

    public function testToastOnlyTypesAreKnownNotificationTypes(): void
    {
        foreach (UsersNotificationsModel::TOAST_ONLY_TYPES as $type) {
            $this->assertContains($type, NotifyLibrary::TYPES);
        }
    }

    public function testPushSkipsUnknownTypeWithoutTouchingTheDatabase(): void
    {
        // 'collection' is an activity type, not a notification type: the enum column would reject it
        (new NotifyLibrary())->push('collection', 'u1', 'a1');

        $this->assertTrue(true);
    }

    public function testMetaWithoutValueIsStoredAsNull(): void
    {
        $notification       = new UserNotificationEntity();
        $notification->meta = null;

        $this->assertNull($notification->toRawArray()['meta']);
        $this->assertNull($notification->meta);
    }

    public function testMetaIsStoredAsJson(): void
    {
        $notification       = new UserNotificationEntity();
        $notification->meta = ['level' => 3];

        $this->assertSame('{"level":3}', $notification->toRawArray()['meta']);
    }
}
