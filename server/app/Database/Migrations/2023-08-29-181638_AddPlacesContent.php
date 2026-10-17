<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPlacesContent extends Migration {
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
                'unique'     => true
            ],
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true
            ],
            'locale' => [
                'type'    => 'ENUM("ru", "en")',
                'default' => 'ru',
                'null'    => false,
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 200,
                'null'       => true
            ],
            'content' => [
                'type' => 'TEXT',
                'null' => true
            ],
            'delta' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
            'deleted_at' => [
                'type' => 'DATETIME',
                'null' => true
            ]
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addKey('title', false, false, 'place_title');
        // No plain key on `content`: MySQL refuses a TEXT key without a length on an empty
        // database. SplitPlacesContentRevisions adds it as `content`(768)
        $this->forge->createTable('places_content');
    }

    public function down()
    {
        $this->forge->dropTable('places_content');
    }
}
