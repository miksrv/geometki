<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * `push_subscriptions_expired`: whose a device was, for a while after the push service
 * dropped it (404/410) and its `push_subscriptions` row was deleted. Firefox often
 * fires `pushsubscriptionchange` only after that: POST /push/subscriptions/renew finds
 * the owner here and the device keeps its pushes. Kept for
 * Notifications::$expiredSubscriptionDays.
 */
class AddPushSubscriptionsExpired extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'endpoint_hash' => ['type' => 'CHAR', 'constraint' => 64, 'null' => false],
            'user_id'       => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            'timezone'      => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true],
            'locale'        => ['type' => 'VARCHAR', 'constraint' => 5, 'null' => true],
            'user_agent'    => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at DATETIME default current_timestamp',
        ]);
        $this->forge->addPrimaryKey('endpoint_hash');
        $this->forge->addKey('created_at');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('push_subscriptions_expired', true);
    }

    public function down()
    {
        $this->forge->dropTable('push_subscriptions_expired', true);
    }
}
