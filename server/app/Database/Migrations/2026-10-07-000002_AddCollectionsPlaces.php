<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds the `collections_places` join table: ordered membership of places in
 * a collection, with an optional per-place note written by the collection
 * owner. No soft delete — removing a place from a collection removes the row.
 */
class AddCollectionsPlaces extends Migration {
    public function up()
    {
        $this->forge->addField([
            'collection_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'position' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => false,
                'default'    => 0,
            ],
            'note' => [
                'type'       => 'VARCHAR',
                'constraint' => 500,
                'null'       => true,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'created_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey(['collection_id', 'place_id']);
        $this->forge->addKey('place_id');
        $this->forge->addForeignKey('collection_id', 'collections', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'SET NULL');
        $this->forge->createTable('collections_places');
    }

    public function down()
    {
        $this->forge->dropTable('collections_places');
    }
}
