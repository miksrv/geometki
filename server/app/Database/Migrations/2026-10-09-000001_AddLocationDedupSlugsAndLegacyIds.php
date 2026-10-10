<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * One feature, one migration (see features/20-location-seo-pages.md,
 * "Предусловия" / "Слаги локаций" / "Технические требования"):
 *
 *  - osm_type/osm_id (indexed, unique per table where non-null) and ISO
 *    codes on the four location tables — location identity moves from an
 *    exact-name match to the stable OSM object (App\Libraries\Geocoder).
 *  - location_aliases — every name a location has ever been known by,
 *    normalized, the geocoder's fallback matching step.
 *  - location_legacy_ids — TEMPORARY, see its own comment below.
 *  - location_slugs / location_slug_history — the shared slug namespace
 *    and its 301 history for the landing-page URLs.
 *  - two composite indexes on `places` (region_id, category) and
 *    (locality_id, category): the landing-page API groups places by
 *    location + category (categories-in-a-location, top-locations-for-a-
 *    category, the location×category sitemap pairs) and these turn that
 *    GROUP BY into an index scan instead of a filesort.
 *
 * Existing location rows are left with osm_type/osm_id/iso_code NULL and no
 * slug; `php spark locations:rebuild` (added alongside this migration)
 * fills them by re-geocoding every place, then assigns slugs.
 */
class AddLocationDedupSlugsAndLegacyIds extends Migration
{
    private const TABLES_WITH_ISO    = ['location_countries', 'location_regions'];
    private const TABLES_WITHOUT_ISO = ['location_districts', 'location_localities'];

    public function up()
    {
        // --- osm_type/osm_id + ISO codes -----------------------------------

        foreach ([...self::TABLES_WITH_ISO, ...self::TABLES_WITHOUT_ISO] as $table) {
            $this->addOsmColumns($table);
        }

        $this->forge->addColumn('location_countries', [
            'iso_code' => [
                'type'       => 'CHAR',
                'constraint' => 2,
                'null'       => true,
                'default'    => null,
                'after'      => 'osm_id',
            ],
        ]);
        $this->db->query('ALTER TABLE location_countries ADD UNIQUE KEY `iso_code` (`iso_code`)');

        $this->forge->addColumn('location_regions', [
            // ISO 3166-2 code, e.g. "RU-BA" — globally unique on its own
            'iso_code' => [
                'type'       => 'VARCHAR',
                'constraint' => 10,
                'null'       => true,
                'default'    => null,
                'after'      => 'osm_id',
            ],
        ]);
        $this->db->query('ALTER TABLE location_regions ADD UNIQUE KEY `iso_code` (`iso_code`)');

        // --- location_aliases ------------------------------------------------
        //
        // `parent_id` is NOT NULL (default 0 = "no parent", used for countries)
        // rather than nullable, because a nullable column would break the
        // unique key below: MySQL treats every NULL as distinct, so two
        // countries named the same could otherwise both get a "unique" row.

        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'null'           => false,
                'auto_increment' => true,
            ],
            'location_type' => [
                'type'       => 'ENUM',
                'constraint' => ['country', 'region', 'district', 'locality'],
                'null'       => false,
            ],
            'location_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => false,
            ],
            'parent_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => false,
                'default'    => 0,
            ],
            'name_normalized' => [
                'type'       => 'VARCHAR',
                'constraint' => 150,
                'null'       => false,
            ],
            'created_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['location_type', 'parent_id', 'name_normalized'], 'location_aliases_unique');
        $this->forge->addKey(['location_type', 'location_id']);
        $this->forge->createTable('location_aliases');

        // --- location_legacy_ids ---------------------------------------------
        //
        // TEMPORARY table. Maps a pre-rebuild location id to the id it was
        // merged into or kept as, filled once by `php spark locations:rebuild`.
        // It exists only to 301-redirect the old `/places?region=2`-style
        // URLs (stages 2-4 of features/20-location-seo-pages.md) during the
        // migration to the new landing-page URLs.
        //
        // Drop this table (and LocationLegacyIdsModel) in a later migration a
        // few months after those stages ship, once the old URLs stop
        // receiving traffic — check the Webmaster/Search Console crawl stats
        // for the old query-string URLs before dropping it. Do NOT drop it as
        // part of this change.

        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'null'           => false,
                'auto_increment' => true,
            ],
            'location_type' => [
                'type'       => 'ENUM',
                'constraint' => ['country', 'region', 'district', 'locality'],
                'null'       => false,
            ],
            'old_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => false,
            ],
            'new_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => false,
            ],
            'created_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['location_type', 'old_id']);
        $this->forge->addKey(['location_type', 'new_id']);
        $this->forge->createTable('location_legacy_ids');

        // --- location_slugs / location_slug_history --------------------------
        //
        // Shared slug namespace across all four location levels. `slug` is
        // unique across the whole table, not just per type, so a region and
        // a locality can never collide on the same path segment.
        //
        // location_slug_history records every slug a location has ever had
        // other than its current one, so an old URL can 301 to the current
        // one. Slugs are immutable once issued; only a future admin
        // override, a duplicate merge, or a primary-slug reassignment writes
        // a new history row.

        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'null'           => false,
                'auto_increment' => true,
            ],
            'slug' => [
                'type'       => 'VARCHAR',
                'constraint' => 90,
                'null'       => false,
            ],
            'type' => [
                'type'       => 'ENUM',
                'constraint' => ['country', 'region', 'district', 'locality'],
                'null'       => false,
            ],
            'entity_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => false,
            ],
            // The one slug shown in links/breadcrumbs when several entities share
            // a name and had to be qualified; see LocationSlugLibrary::assignAll().
            'is_primary' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
            'created_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('slug');
        $this->forge->addUniqueKey(['type', 'entity_id']);
        $this->forge->createTable('location_slugs');

        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'null'           => false,
                'auto_increment' => true,
            ],
            'old_slug' => [
                'type'       => 'VARCHAR',
                'constraint' => 90,
                'null'       => false,
            ],
            'type' => [
                'type'       => 'ENUM',
                'constraint' => ['country', 'region', 'district', 'locality'],
                'null'       => false,
            ],
            'entity_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => false,
            ],
            'created_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('old_slug');
        $this->forge->addKey(['type', 'entity_id']);
        $this->forge->createTable('location_slug_history');

        // --- places: composite indexes for the landing-page API's GROUP BYs --

        $this->db->query('ALTER TABLE places ADD INDEX idx_region_category (region_id, category)');
        $this->db->query('ALTER TABLE places ADD INDEX idx_locality_category (locality_id, category)');
    }

    private function addOsmColumns(string $table): void
    {
        $this->forge->addColumn($table, [
            'osm_type' => [
                'type'       => 'ENUM',
                'constraint' => ['node', 'way', 'relation'],
                'null'       => true,
                'default'    => null,
                'after'      => 'id',
            ],
            'osm_id' => [
                'type'       => 'BIGINT',
                'constraint' => 20,
                'unsigned'   => true,
                'null'       => true,
                'default'    => null,
                'after'      => 'osm_type',
            ],
        ]);
        $this->db->query("ALTER TABLE {$table} ADD UNIQUE KEY `osm_type_id` (`osm_type`, `osm_id`)");
    }

    public function down()
    {
        $this->db->query('ALTER TABLE places DROP INDEX idx_locality_category');
        $this->db->query('ALTER TABLE places DROP INDEX idx_region_category');

        $this->forge->dropTable('location_slug_history', true);
        $this->forge->dropTable('location_slugs', true);

        $this->forge->dropTable('location_legacy_ids', true);

        $this->forge->dropTable('location_aliases', true);

        $this->db->query('ALTER TABLE location_regions DROP KEY `iso_code`');
        $this->forge->dropColumn('location_regions', 'iso_code');

        $this->db->query('ALTER TABLE location_countries DROP KEY `iso_code`');
        $this->forge->dropColumn('location_countries', 'iso_code');

        foreach ([...self::TABLES_WITHOUT_ISO, ...self::TABLES_WITH_ISO] as $table) {
            $this->db->query("ALTER TABLE {$table} DROP KEY `osm_type_id`");
            $this->forge->dropColumn($table, ['osm_type', 'osm_id']);
        }
    }
}
