<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class IncreaseSendingMailSubjectLength extends Migration
{
    public function up()
    {
        $this->forge->modifyColumn('sending_mail', [
            'subject' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
        ]);
    }

    public function down()
    {
        $this->forge->modifyColumn('sending_mail', [
            'subject' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
        ]);
    }
}

