<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddUsers extends Migration {
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
                'unique'     => true
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => false
            ],
            'email' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => false,
                'unique'     => true
            ],
            'password'       => [
                'type'       => 'VARCHAR',
                'constraint' => 200,
                'null'       => true
            ],
            'auth_type' => [
                'type'  => 'ENUM("native", "google", "yandex", "vk")',
                'null'  => true
            ],
            'role' => [
                'type'    => 'ENUM("user", "moderator", "admin")',
                'null'    => false,
                'default' => 'user'
            ],
            'locale' => [
                'type'    => 'ENUM("ru", "en")',
                'default' => 'ru',
                'null'    => false,
            ],
            'level' => [
                'type'       => 'TINYINT',
                'constraint' => 3,
                'null'       => false,
                'default'    => 1
            ],
            'experience' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0
            ],
            'reputation' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0
            ],
            'website' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
            'avatar' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
            'settings' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
            'activity_at' => [
                'type' => 'DATETIME',
                'null' => true
            ],
            'deleted_at' => [
                'type' => 'DATETIME',
                'null' => true
            ]
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('users');
    }

    public function down()
    {
        $this->forge->dropTable('users');
    }
}
