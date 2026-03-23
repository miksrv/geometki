<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlaceViewsLog extends Migration {
    public function up()
    {
        $this->forge->addField([
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'view_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'count' => [
                'type'     => 'MEDIUMINT',
                'unsigned' => true,
                'null'     => false,
                'default'  => 1,
            ],
        ]);

        $this->forge->addPrimaryKey(['place_id', 'view_date']);
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('place_views_log');
    }

    public function down()
    {
        $this->forge->dropTable('place_views_log');
    }
}
