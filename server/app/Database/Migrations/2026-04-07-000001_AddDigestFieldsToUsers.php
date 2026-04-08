<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDigestFieldsToUsers extends Migration
{
    public function up()
    {
        $this->forge->addColumn('users', [
            'digest_sent_at' => [
                'type'    => 'DATETIME',
                'null'    => true,
                'default' => null,
                'after'   => 'settings',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', 'digest_sent_at');
    }
}
