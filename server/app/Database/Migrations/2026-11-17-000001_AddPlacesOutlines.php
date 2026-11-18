<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The outlines of large places (a lake, a park, a kremlin) from OpenStreetMap: "near the place"
 * is near its outline too, not only near its point (GameLibrary::isNear()). One row per place
 * that `php spark places:outlines` checked; `geometry` null when OSM has no fitting outline.
 * And an index of the places by their position, for the neighbours of a place.
 *
 * MySQL commits every DDL statement on its own: running the migration again finishes a run
 * that failed halfway.
 */
class AddPlacesOutlines extends Migration
{
    public function up(): void
    {
        // The neighbours of a place (GameLibrary::zoneOf()) are found by a box around it
        if (!$this->db->query("SHOW INDEX FROM places WHERE Key_name = 'places_lat_lon'")->getRow()) {
            $this->db->query('ALTER TABLE places ADD INDEX places_lat_lon (lat, lon)');
        }

        if ($this->db->tableExists('places_outlines')) {
            return;
        }

        $this->forge->addField([
            'place_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            // `way/123`, `relation/456`; null when nothing fitted
            'source'     => ['type' => 'VARCHAR', 'constraint' => 40, 'null' => true],
            // The name of the OSM object, to see what was taken
            'name'       => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            // The diagonal of its bounding box, metres
            'size'       => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            // JSON, simplified: {rings: [[[lat, lon], ...], ...], lines: [...]} (PlaceOutlines)
            'geometry'   => ['type' => 'MEDIUMTEXT', 'null' => true],
            'checked_at' => ['type' => 'DATETIME', 'null' => false],
        ]);
        $this->forge->addPrimaryKey('place_id');
        $this->forge->addKey(['source', 'checked_at']);
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('places_outlines');
    }

    public function down(): void
    {
        $this->forge->dropTable('places_outlines', true);

        if ($this->db->query("SHOW INDEX FROM places WHERE Key_name = 'places_lat_lon'")->getRow()) {
            $this->db->query('ALTER TABLE places DROP INDEX places_lat_lon');
        }
    }
}
