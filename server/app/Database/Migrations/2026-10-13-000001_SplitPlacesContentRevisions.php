<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Splits place texts into the current text and its edit history:
 *
 *  - places_content keeps exactly one row per (place_id, locale) — the text the site
 *    shows. Reads become a plain lookup instead of a MAX(created_at) subquery, and the
 *    FULLTEXT search no longer matches (and returns) superseded versions.
 *  - places_content_revisions is an append-only log of every saved version, read only
 *    to roll a text back (`php spark content:revert`). Edits by the same author of the
 *    same locale within 24 hours update their last revision instead of adding one
 *    (App\Models\PlacesContentModel::saveContent()).
 *
 * Every existing row, superseded or not, is copied into the log first, so no version
 * is lost. The current row of each pair is the latest by created_at (ties broken by
 * updated_at, then id) — the one the site already shows.
 *
 * Also drops what nothing uses: the unique `id` key duplicating the primary key, the
 * BTREE keys on title and on a 768-char prefix of content (search goes through the
 * FULLTEXT keys) and the never-set deleted_at column.
 */
class SplitPlacesContentRevisions extends Migration
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
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'locale' => [
                'type'    => 'ENUM("ru", "en")',
                'default' => 'ru',
                'null'    => false,
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 200,
                'null'       => true,
            ],
            'content' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'delta' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0,
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['place_id', 'locale', 'created_at'], false, false, 'place_locale_created');
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        // The history outlives its author: a removed user leaves anonymous revisions
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'SET NULL');
        $this->forge->createTable('places_content_revisions');

        $this->db->query(
            'INSERT INTO places_content_revisions (id, place_id, user_id, locale, title, content, delta, created_at, updated_at)
             SELECT id, place_id, user_id, locale, title, content, delta, created_at, updated_at
             FROM places_content
             WHERE place_id IS NOT NULL'
        );

        // Keep only the latest row of each (place_id, locale)
        $this->db->query(
            'DELETE pc FROM places_content pc
             JOIN places_content newer
               ON newer.place_id = pc.place_id
              AND newer.locale = pc.locale
              AND (
                    newer.created_at > pc.created_at
                 OR (newer.created_at = pc.created_at AND newer.updated_at > pc.updated_at)
                 OR (newer.created_at = pc.created_at AND newer.updated_at = pc.updated_at AND newer.id > pc.id)
              )'
        );
        $this->db->query('DELETE FROM places_content WHERE place_id IS NULL');

        // The unique key also serves the place_id foreign key, so its own index goes
        $this->db->query('ALTER TABLE places_content ADD UNIQUE KEY `place_locale` (`place_id`, `locale`)');
        $this->dropIndexIfExists('places_content', 'places_content_place_id_foreign');
        $this->dropIndexIfExists('places_content', 'id');
        $this->dropIndexIfExists('places_content', 'place_title');
        $this->dropIndexIfExists('places_content', 'place_content');
        $this->forge->dropColumn('places_content', 'deleted_at');
    }

    public function down()
    {
        $this->forge->addColumn('places_content', [
            'deleted_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->db->query('ALTER TABLE places_content ADD KEY `places_content_place_id_foreign` (`place_id`)');
        $this->db->query('ALTER TABLE places_content DROP INDEX `place_locale`');
        $this->db->query('ALTER TABLE places_content ADD UNIQUE KEY `id` (`id`)');
        $this->db->query('ALTER TABLE places_content ADD KEY `place_title` (`title`)');
        $this->db->query('ALTER TABLE places_content ADD KEY `place_content` (`content`(768))');

        // Superseded versions go back next to the current ones
        $this->db->query(
            'INSERT IGNORE INTO places_content (id, place_id, user_id, locale, title, content, delta, created_at, updated_at)
             SELECT id, place_id, user_id, locale, title, content, delta, created_at, updated_at
             FROM places_content_revisions'
        );

        $this->forge->dropTable('places_content_revisions');
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        $exists = $this->db->query('SHOW INDEX FROM `' . $table . '` WHERE Key_name = ?', [$index])->getResult();

        if (!empty($exists)) {
            $this->db->query('ALTER TABLE `' . $table . '` DROP INDEX `' . $index . '`');
        }
    }
}
