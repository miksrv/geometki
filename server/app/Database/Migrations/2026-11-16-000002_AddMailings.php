<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Mailings: the email newsletters an administrator writes (`mailings`, in Russian only), and the link from a queued
 * letter to its mailing (`sending_mail.mailing_id`). A queued letter of a mailing keeps no body:
 * the queue renders it from the mailing when it sends it.
 *
 * MySQL commits every DDL statement on its own: each step checks whether it is still needed,
 * so running the migration again finishes a run that failed halfway.
 */
class AddMailings extends Migration
{
    public function up(): void
    {
        if (!$this->db->tableExists('mailings')) {
            $this->forge->addField([
                'id'              => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'subject'         => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => false],
                'content'         => ['type' => 'TEXT', 'null' => false],
                'button_label'    => ['type' => 'VARCHAR', 'constraint' => 60, 'null' => true],
                'button_url'      => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
                'image'           => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
                'status'          => ['type' => 'ENUM', 'constraint' => ['draft', 'sending', 'completed', 'canceled'], 'null' => false, 'default' => 'draft'],
                'recipients'      => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
                // The delivery numbers kept once the mailing is finished: its queue rows are deleted
                // after `Notifications::$retentionDays` (MailingsModel::freezeDelivery()); null before
                'delivered'       => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'failed'          => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'rejected'        => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'author_id'       => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
                'sent_at'         => ['type' => 'DATETIME', 'null' => true],
                'completed_at'    => ['type' => 'DATETIME', 'null' => true],
                'created_at'      => ['type' => 'DATETIME', 'null' => true],
                'updated_at'      => ['type' => 'DATETIME', 'null' => true],
                'deleted_at'      => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->addKey(['status', 'created_at']);
            $this->forge->addForeignKey('author_id', 'users', 'id', 'SET NULL', 'CASCADE');
            $this->forge->createTable('mailings');
        }

        if (!$this->db->fieldExists('mailing_id', 'sending_mail')) {
            $this->forge->addColumn('sending_mail', [
                'mailing_id' => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true, 'after' => 'activity_id'],
            ]);
        }

        if (!$this->db->query("SHOW INDEX FROM sending_mail WHERE Key_name = 'sending_mail_mailing'")->getRow()) {
            $this->db->query('ALTER TABLE sending_mail ADD INDEX sending_mail_mailing (mailing_id, status)');
        }

        if (!$this->db->query("SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sending_mail' AND CONSTRAINT_NAME = 'sending_mail_mailing_fk'")->getRow()) {
            $this->db->query('ALTER TABLE sending_mail ADD CONSTRAINT sending_mail_mailing_fk FOREIGN KEY (mailing_id) REFERENCES mailings (id) ON DELETE CASCADE ON UPDATE CASCADE');
        }
    }

    public function down(): void
    {
        if ($this->db->fieldExists('mailing_id', 'sending_mail')) {
            $this->db->query('ALTER TABLE sending_mail DROP FOREIGN KEY sending_mail_mailing_fk');
            $this->forge->dropColumn('sending_mail', 'mailing_id');
        }

        $this->forge->dropTable('mailings', true);
    }
}
