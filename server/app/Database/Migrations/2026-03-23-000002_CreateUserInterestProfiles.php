<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateUserInterestProfiles extends Migration {
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'interest_type' => [
                'type'       => 'ENUM',
                'constraint' => ['category', 'tag'],
                'null'       => false,
            ],
            'interest_value' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'affinity' => [
                'type'    => 'FLOAT',
                'null'    => false,
                'default' => 0,
            ],
            'ignored' => [
                'type'    => 'BOOLEAN',
                'null'    => false,
                'default' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['user_id', 'interest_type', 'interest_value'], 'user_interest_unique');
        $this->forge->addKey('user_id', false, false, 'user_interests_user_idx');
        $this->forge->addKey(['interest_type', 'interest_value'], false, false, 'user_interests_type_value_idx');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('users_interest_profiles');
    }

    public function down()
    {
        $this->forge->dropTable('users_interest_profiles');
    }
}
