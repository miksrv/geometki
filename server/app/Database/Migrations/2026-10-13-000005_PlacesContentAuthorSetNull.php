<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * places_content now holds one current text per (place, locale)
 * (SplitPlacesContentRevisions), so its old `user_id ... ON DELETE CASCADE` would wipe
 * that text when its last author is removed from `users`. The author becomes NULL
 * instead, as in places_content_revisions.
 */
class PlacesContentAuthorSetNull extends Migration
{
    public function up()
    {
        $this->replaceUserForeignKey('SET NULL');
    }

    public function down()
    {
        $this->replaceUserForeignKey('CASCADE');
    }

    private function replaceUserForeignKey(string $onDelete): void
    {
        $existing = $this->db->query(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'places_content'
               AND COLUMN_NAME = 'user_id'
               AND REFERENCED_TABLE_NAME = 'users'"
        )->getResult();

        foreach ($existing as $row) {
            $this->db->query('ALTER TABLE places_content DROP FOREIGN KEY `' . $row->CONSTRAINT_NAME . '`');
        }

        $this->db->query(
            'ALTER TABLE places_content ADD CONSTRAINT `places_content_user_id_foreign`
             FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE ' . $onDelete
        );
    }
}
