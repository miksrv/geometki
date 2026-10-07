<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds the `collections` table (Phase 1 MVP of the Collections feature).
 *
 * A collection is an author-curated, published-immediately list of places
 * with a markdown description. Indexability for search engines is computed
 * server-side and cached in `indexable` (see App\Libraries\CollectionIndexability).
 */
class AddCollections extends Migration {
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
                'unique'     => true,
            ],
            'slug' => [
                'type'       => 'VARCHAR',
                'constraint' => 120,
                'null'       => true,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 120,
                'null'       => false,
            ],
            'description' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'title_en' => [
                'type'       => 'VARCHAR',
                'constraint' => 120,
                'null'       => true,
            ],
            'description_en' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'region_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
            ],
            'country_id' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => true,
            ],
            'cover_place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'cover_photo_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'hidden' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
            'featured' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
            'indexable' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
            'places_count' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0,
            ],
            'views' => [
                'type'       => 'MEDIUMINT',
                'constraint' => 10,
                'null'       => false,
                'default'    => 0,
            ],
            'saves' => [
                'type'       => 'MEDIUMINT',
                'constraint' => 10,
                'null'       => false,
                'default'    => 0,
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
            'deleted_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['hidden', 'indexable', 'updated_at']);
        $this->forge->addKey('region_id');
        $this->forge->addKey('user_id');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('country_id', 'location_countries', 'id', 'CASCADE', 'SET NULL');
        $this->forge->addForeignKey('region_id', 'location_regions', 'id', 'CASCADE', 'SET NULL');
        $this->forge->addForeignKey('cover_place_id', 'places', 'id', 'CASCADE', 'SET NULL');
        $this->forge->addForeignKey('cover_photo_id', 'photos', 'id', 'CASCADE', 'SET NULL');
        $this->forge->createTable('collections');
    }

    public function down()
    {
        $this->forge->dropTable('collections');
    }
}
