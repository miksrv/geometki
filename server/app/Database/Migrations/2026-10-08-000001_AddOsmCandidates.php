<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * OSM candidates: interesting objects from OpenStreetMap that are not on Geometki yet.
 *
 * - `osm_tiles`: the collection queue, one row per 0.1° × 0.1° tile (never queued twice)
 * - `osm_candidates`: scored objects from OSM and Wikidata (glued together when they are the same object),
 *   with their raw data, enrichment, photos and the link to a place
 *
 * Also drops the unused `overpass_category` table of the old Overpass experiment:
 * the tag → category rules now live in Config\OsmCandidates.
 */
class AddOsmCandidates extends Migration
{
    public function up()
    {
        $this->forge->dropTable('overpass_category', true);

        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            // floor(lat × 10) and floor(lon × 10)
            'tile_lat' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
            ],
            'tile_lon' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['queued', 'processing', 'done', 'failed'],
                'null'       => false,
                'default'    => 'queued',
            ],
            // Grows every time the tile is looked at on the map, the collector takes the most wanted first
            'priority' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => false,
                'default'    => 0,
            ],
            'attempts' => [
                'type'       => 'TINYINT',
                'constraint' => 3,
                'null'       => false,
                'default'    => 0,
            ],
            'last_error' => [
                'type'       => 'VARCHAR',
                'constraint' => 500,
                'null'       => true,
            ],
            'candidates_count' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0,
            ],
            'requested_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'fetched_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'next_fetch_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            // Set while a collector works on the tile, a stale lock means the collector died
            'locked_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['tile_lat', 'tile_lon']);
        $this->forge->addKey(['status', 'priority']);
        $this->forge->createTable('osm_tiles');

        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
                'unique'     => true,
            ],
            // osm: an OSM object (maybe enriched from Wikidata); wikidata: found only in Wikidata
            'source' => [
                'type'       => 'ENUM',
                'constraint' => ['osm', 'wikidata'],
                'null'       => false,
                'default'    => 'osm',
            ],
            // Null for the objects found only in Wikidata
            'osm_type' => [
                'type'       => 'ENUM',
                'constraint' => ['node', 'way', 'relation'],
                'null'       => true,
            ],
            'osm_id' => [
                'type'       => 'BIGINT',
                'constraint' => 20,
                'unsigned'   => true,
                'null'       => true,
            ],
            'tile_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
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
            // Diagonal of the object's bounding box, meters; null for points
            'size_m' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 250,
                'null'       => true,
            ],
            // The tag that defined the type, e.g. "natural=peak"
            'osm_tag' => [
                'type'       => 'VARCHAR',
                'constraint' => 60,
                'null'       => false,
            ],
            'category' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
            // Raw OSM tags, or the Wikidata facts for a Wikidata object (JSON):
            // scores are recalculated from them without asking the sources again
            'tags' => [
                'type' => 'MEDIUMTEXT',
                'null' => false,
            ],
            'wikipedia' => [
                'type'       => 'VARCHAR',
                'constraint' => 250,
                'null'       => true,
            ],
            'wikidata' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            // 'osm': the link is in the OSM tags; 'nearby': an article with a similar title was found nearby;
            // 'wikidata': the Wikidata item with a similar title nearby was glued to the OSM object
            'wiki_source' => [
                'type'       => 'ENUM',
                'constraint' => ['osm', 'nearby', 'wikidata'],
                'null'       => true,
            ],
            'wiki_distance' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'unsigned'   => true,
                'null'       => true,
            ],
            // Number of Wikipedia language versions about the object
            'sitelinks' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'unsigned'   => true,
                'null'       => true,
            ],
            // Code of the Russian cultural heritage register (Wikidata P1483 or OSM ref:okn)
            'heritage' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            // JSON list of photos from Wikimedia Commons with their author and licence
            'photos' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'settlement_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 150,
                'null'       => true,
            ],
            'settlement_type' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            // Distance from the settlement's edge, meters; 0 means inside
            'settlement_distance' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'score' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0,
            ],
            // JSON list of {code, points, value?}: why the object got its score
            'score_breakdown' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            // known: enough information for a card, explore: interesting but unexplored, other: the rest
            'tier' => [
                'type'       => 'ENUM',
                'constraint' => ['known', 'explore', 'other'],
                'null'       => false,
                'default'    => 'other',
            ],
            // gone: disappeared from OSM or no longer matches the rules
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['open', 'linked', 'rejected', 'gone'],
                'null'       => false,
                'default'    => 'open',
            ],
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'linked_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'linked_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            // Last collection that still found the object in OSM
            'seen_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['osm_type', 'osm_id']);
        // The collector looks the objects of a tile up by their OSM ids alone
        $this->forge->addKey('osm_id');
        $this->forge->addKey(['lat', 'lon']);
        $this->forge->addKey(['status', 'tier']);
        $this->forge->addKey('tile_id');
        $this->forge->addKey('place_id');
        $this->forge->addKey('wikidata');
        $this->forge->addForeignKey('tile_id', 'osm_tiles', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'SET NULL');
        $this->forge->addForeignKey('linked_by', 'users', 'id', 'CASCADE', 'SET NULL');
        $this->forge->createTable('osm_candidates');
    }

    public function down()
    {
        $this->forge->dropTable('osm_candidates', true);
        $this->forge->dropTable('osm_tiles', true);

        // The old table comes back empty, as it was created by AddOverpassCategory
        $this->forge->addField([
            'id' => [
                'type'           => 'SMALLINT',
                'constraint'     => 5,
                'null'           => false,
                'unique'         => true,
                'auto_increment' => true,
            ],
            'category' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'subcategory' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'category_map' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('overpass_category');
    }
}
