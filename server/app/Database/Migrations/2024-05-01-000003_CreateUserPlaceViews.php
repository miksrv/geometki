<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateUserPlaceViews extends Migration {
    public function up()
    {
        $this->forge->addField([
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'last_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey(['user_id', 'place_id']);
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('user_place_views');
    }

    public function down()
    {
        $this->forge->dropTable('user_place_views');
    }
}
