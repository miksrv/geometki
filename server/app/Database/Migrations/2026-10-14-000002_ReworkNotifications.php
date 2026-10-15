<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Notifications by email and web push (features/16-weekly-digest-push-notifications.md).
 *
 * 1. The email queue `sending_mail` becomes a real queue (`notifications:send`):
 *    - `user_id` — the recipient; replaces matching users by the `email` text;
 *    - `type` — notification type (comment, …, digest), the unsubscribe scope;
 *    - `attempts`, `next_attempt_at` — retries with back-off, and the wait before
 *      the next activity email, whose events then go out together;
 *    - `locked_by`, `locked_at` — the run that claimed the row, so overlapping
 *      cron runs never send it twice;
 *    - `sent_at` — the send time the hourly / daily limits count;
 *    - `group_id` — the row whose email carried this one (status `grouped`);
 *    - statuses `expired` (not sent in time) and `grouped`;
 *    - `email` becomes an indexable VARCHAR.
 *    `users.email_bounced_at` marks an address the mail server rejected as
 *    nonexistent; notifications are no longer sent to it.
 * 2. Web push:
 *    - `push_subscriptions` — a browser's push subscription, bound to the user who
 *      enabled push on that device (several devices per user). `endpoint_hash`
 *      (SHA-256 of the endpoint) is the lookup key: the endpoint itself is a long URL;
 *    - `push_messages` — the push queue, the same mechanics as `sending_mail`
 *      (App\Models\QueueRows). `notification_id` is the in-app notification the push
 *      repeats: when the user already saw it on the site, the push is dropped.
 * 3. `tags.count` was kept right by a per-minute cron recount (system:calculate-tags-count,
 *    removed): the counter is now updated atomically (App\Libraries\PlaceTags), and it is
 *    recounted once here to drop the drift of the read-modify-write updates before.
 *
 * MySQL runs each ALTER on its own (DDL is not transactional): if one fails,
 * fix the cause and finish the remaining statements by hand before `down()`.
 */
class ReworkNotifications extends Migration
{
    public function up()
    {
        $this->upEmailQueue();
        $this->upPush();
        $this->recountTags();
    }

    public function down()
    {
        // Nothing to undo for the tag counts: they are just right
        $this->downPush();
        $this->downEmailQueue();
    }

    private function upEmailQueue(): void
    {
        // `email` becomes VARCHAR(255): refuse rather than silently cut a longer address
        $tooLong = (int) $this->db->query('SELECT COUNT(*) AS cnt FROM `sending_mail` WHERE CHAR_LENGTH(`email`) > 255')->getRow()->cnt;

        if ($tooLong > 0) {
            throw new \RuntimeException("sending_mail has {$tooLong} email values longer than 255 characters; fix them before migrating");
        }

        $this->db->simpleQuery("
            ALTER TABLE `sending_mail`
                MODIFY `status` ENUM('created', 'process', 'completed', 'error', 'rejected', 'expired', 'grouped') NOT NULL DEFAULT 'created',
                MODIFY `email` VARCHAR(255) NULL,
                ADD `user_id` VARCHAR(15) NULL AFTER `activity_id`,
                ADD `type` VARCHAR(20) NULL AFTER `user_id`,
                ADD `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `error`,
                ADD `next_attempt_at` DATETIME NULL AFTER `attempts`,
                ADD `locked_by` VARCHAR(32) NULL AFTER `next_attempt_at`,
                ADD `locked_at` DATETIME NULL AFTER `locked_by`,
                ADD `sent_at` DATETIME NULL AFTER `locked_at`,
                ADD `group_id` VARCHAR(15) NULL AFTER `sent_at`
        ");

        // Backfill: recipient, type and send time of the existing rows
        $this->db->simpleQuery('
            UPDATE `sending_mail` sm
            JOIN `users` u ON u.email = sm.email AND u.deleted_at IS NULL
            SET sm.user_id = u.id
        ');
        $this->db->simpleQuery('
            UPDATE `sending_mail` sm
            JOIN `activity` a ON a.id = sm.activity_id
            SET sm.type = a.type
        ');
        $this->db->simpleQuery("
            UPDATE `sending_mail`
            SET `type` = 'digest'
            WHERE `activity_id` IS NULL AND `subject` IS NOT NULL
        ");
        $this->db->simpleQuery("
            UPDATE `sending_mail`
            SET `sent_at` = `updated_at`
            WHERE `status` = 'completed'
        ");

        // The old sender skipped rows older than a day and left them `created`: do not
        // send that backlog now
        $this->db->query(
            "UPDATE `sending_mail` SET `status` = 'expired' WHERE `status` IN ('created', 'process') AND `created_at` < ?",
            [date('Y-m-d H:i:s', strtotime('-1 day'))]
        );

        // Unsent digests of the old code hold a whole HTML document, the new queue would wrap it
        // in the layout once more: drop them, the next weekly run builds new ones
        $this->db->simpleQuery("
            UPDATE `sending_mail` SET `status` = 'expired'
            WHERE `type` = 'digest' AND `status` IN ('created', 'process')
        ");

        $this->db->simpleQuery('
            ALTER TABLE `sending_mail`
                ADD INDEX `sending_mail_queue` (`status`, `next_attempt_at`),
                ADD INDEX `sending_mail_user_sent` (`user_id`, `sent_at`),
                ADD INDEX `sending_mail_sent` (`sent_at`),
                ADD INDEX `sending_mail_created` (`created_at`),
                ADD INDEX `sending_mail_email` (`email`),
                ADD INDEX `sending_mail_locked_by` (`locked_by`)
        ');

        $this->forge->addColumn('users', [
            'email_bounced_at' => ['type' => 'DATETIME', 'null' => true, 'after' => 'email'],
        ]);
    }

    private function downEmailQueue(): void
    {
        $this->forge->dropColumn('users', 'email_bounced_at');

        $this->db->simpleQuery('
            ALTER TABLE `sending_mail`
                DROP INDEX `sending_mail_queue`,
                DROP INDEX `sending_mail_user_sent`,
                DROP INDEX `sending_mail_sent`,
                DROP INDEX `sending_mail_created`,
                DROP INDEX `sending_mail_email`,
                DROP INDEX `sending_mail_locked_by`
        ');

        $this->db->simpleQuery("UPDATE `sending_mail` SET `status` = 'completed' WHERE `status` = 'grouped'");
        $this->db->simpleQuery("UPDATE `sending_mail` SET `status` = 'rejected' WHERE `status` = 'expired'");

        $this->db->simpleQuery("
            ALTER TABLE `sending_mail`
                MODIFY `status` ENUM('created', 'process', 'completed', 'error', 'rejected') NOT NULL DEFAULT 'created',
                MODIFY `email` TEXT NULL,
                DROP `user_id`,
                DROP `type`,
                DROP `attempts`,
                DROP `next_attempt_at`,
                DROP `locked_by`,
                DROP `locked_at`,
                DROP `sent_at`,
                DROP `group_id`
        ");
    }

    private function upPush(): void
    {
        $this->forge->addField([
            'id'               => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            'user_id'          => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            'endpoint'         => ['type' => 'TEXT', 'null' => false],
            'endpoint_hash'    => ['type' => 'CHAR', 'constraint' => 64, 'null' => false],
            'p256dh'           => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
            'auth'             => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
            'content_encoding' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => false, 'default' => 'aes128gcm'],
            'timezone'         => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true],
            'locale'           => ['type' => 'VARCHAR', 'constraint' => 5, 'null' => true],
            'user_agent'       => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'failures'         => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => false, 'default' => 0],
            'last_success_at'  => ['type' => 'DATETIME', 'null' => true],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('endpoint_hash');
        $this->forge->addKey('user_id');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('push_subscriptions');

        $this->forge->addField([
            'id'              => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            'user_id'         => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            'type'            => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => false],
            'activity_id'     => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
            'notification_id' => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
            'meta'            => ['type' => 'TEXT', 'null' => true],
            'status'          => [
                'type'    => 'ENUM("created", "process", "completed", "grouped", "error", "rejected", "expired")',
                'null'    => false,
                'default' => 'created',
            ],
            'error'           => ['type' => 'TEXT', 'null' => true],
            'attempts'        => ['type' => 'TINYINT', 'unsigned' => true, 'null' => false, 'default' => 0],
            'next_attempt_at' => ['type' => 'DATETIME', 'null' => true],
            'locked_by'       => ['type' => 'VARCHAR', 'constraint' => 32, 'null' => true],
            'locked_at'       => ['type' => 'DATETIME', 'null' => true],
            'sent_at'         => ['type' => 'DATETIME', 'null' => true],
            'group_id'        => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
            'deleted_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['status', 'next_attempt_at'], false, false, 'push_messages_queue');
        $this->forge->addKey(['user_id', 'sent_at'], false, false, 'push_messages_user_sent');
        $this->forge->addKey('activity_id', false, false, 'push_messages_activity');
        $this->forge->addKey('created_at', false, false, 'push_messages_created');
        $this->forge->addKey('locked_by', false, false, 'push_messages_locked_by');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('push_messages');
    }

    private function downPush(): void
    {
        $this->forge->dropTable('push_messages', true);
        $this->forge->dropTable('push_subscriptions', true);
    }

    private function recountTags(): void
    {
        $this->db->simpleQuery('
            UPDATE `tags` t
            SET t.`count` = (SELECT COUNT(*) FROM `places_tags` pt WHERE pt.`tag_id` = t.`id`)
        ');
    }
}
