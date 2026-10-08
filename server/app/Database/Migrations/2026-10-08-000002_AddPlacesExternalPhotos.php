<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Photos from Wikimedia Commons and PastVu linked to places.
 *
 * The files are never downloaded: a row keeps the links to the images on the source servers,
 * the author and the licence for the caption, and the photo position to mark the linked photos
 * on the map.
 */
class AddPlacesExternalPhotos extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            // Who linked the photo: never shown, used for the unlink rights
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'source' => [
                'type'       => 'ENUM',
                'constraint' => ['wikimedia', 'pastvu'],
                'null'       => false,
            ],
            // Commons pageid or PastVu cid
            'external_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'lat' => [
                'type' => 'DECIMAL(10,6)',
                'null' => false,
            ],
            'lon' => [
                'type' => 'DECIMAL(10,6)',
                'null' => false,
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'author' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'license' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'license_url' => [
                'type'       => 'VARCHAR',
                'constraint' => 500,
                'null'       => true,
            ],
            'year' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => true,
            ],
            'page_url' => [
                'type'       => 'VARCHAR',
                'constraint' => 1000,
                'null'       => false,
            ],
            'full_url' => [
                'type'       => 'VARCHAR',
                'constraint' => 1000,
                'null'       => false,
            ],
            'preview_url' => [
                'type'       => 'VARCHAR',
                'constraint' => 1000,
                'null'       => false,
            ],
            'width' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
            ],
            'height' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
            ],
            'created_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['place_id', 'source', 'external_id']);
        $this->forge->addKey(['source', 'external_id']);
        $this->forge->addKey(['lat', 'lon']);
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'SET NULL');
        $this->forge->createTable('places_external_photos');
    }

    public function down()
    {
        $this->forge->dropTable('places_external_photos', true);
    }
}
