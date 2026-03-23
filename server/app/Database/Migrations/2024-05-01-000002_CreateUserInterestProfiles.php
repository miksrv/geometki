<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateUserInterestProfiles extends Migration {
    public function up()
    {
        $this->forge->addField([
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'category' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'affinity' => [
                'type'    => 'FLOAT',
                'null'    => false,
                'default' => 0,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey(['user_id', 'category']);
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('user_interest_profiles');
    }

    public function down()
    {
        $this->forge->dropTable('user_interest_profiles');
    }
}
