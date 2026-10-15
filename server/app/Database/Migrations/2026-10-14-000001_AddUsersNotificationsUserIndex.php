<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Index behind every notification query: the badge counts a user's unread notifications,
 * toasts read their recent unread ones and the list pages through them by creation time.
 * Before it only the user_id foreign key index existed, so MySQL sorted all of a user's rows.
 */
class AddUsersNotificationsUserIndex extends Migration {
    public function up()
    {
        $this->db->simpleQuery(
            'ALTER TABLE `users_notifications` ADD INDEX `users_notifications_user_read_created` (`user_id`, `read`, `created_at`)'
        );
    }

    public function down()
    {
        $this->db->simpleQuery(
            'ALTER TABLE `users_notifications` DROP INDEX `users_notifications_user_read_created`'
        );
    }
}
