<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds the 'bookmark' activity type and brings the users_notifications.type
 * enum in line with the activity types that can actually be pushed to it
 * ('visit' was already produced by ActivityLibrary but was never added here,
 * and 'bookmark' is new).
 */
class AddBookmarkAndVisitNotificationTypes extends Migration {
    public function up()
    {
        $this->db->simpleQuery(
            "ALTER TABLE `activity` MODIFY `type` ENUM('photo','place','rating','edit','cover','comment','visit','bookmark') NOT NULL"
        );

        $this->db->simpleQuery(
            "ALTER TABLE `users_notifications` MODIFY `type` ENUM('photo','place','rating','comment','edit','cover','experience','level','achievements','visit','bookmark') NOT NULL"
        );
    }

    public function down()
    {
        $this->db->simpleQuery(
            "ALTER TABLE `users_notifications` MODIFY `type` ENUM('photo','place','rating','comment','edit','cover','experience','level','achievements') NOT NULL"
        );

        $this->db->simpleQuery(
            "ALTER TABLE `activity` MODIFY `type` ENUM('photo','place','rating','edit','cover','comment','visit') NOT NULL"
        );
    }
}
