<?php namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

class AddErrorFieldToSendingMail extends Migration {
    public function up() {
        $this->forge->addColumn('sending_mail', [
            'error' => ['type' => 'TEXT', 'null' => true, 'after' => 'sent_email']
        ]);
    }
    public function down() {
        $this->forge->dropColumn('sending_mail', 'error');
    }
}
