<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds the 'collection' and 'collection_place' activity types, the matching
 * 'collection_place' notification type, and a nullable `collection_id`
 * column on `activity` so that both types can reference the collection they
 * belong to (collection_place also uses the existing `place_id` column for
 * the place that was added).
 *
 * No foreign key is added for `collection_id` to keep this ALTER simple and
 * portable, mirroring how `activity.place_id` etc. are plain columns backed
 * by FKs only at table-creation time elsewhere in this codebase.
 */
class AddCollectionActivityTypes extends Migration {
    public function up()
    {
        $this->forge->addColumn('activity', [
            'collection_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
                'after'      => 'place_id',
            ],
        ]);

        $this->db->simpleQuery(
            "ALTER TABLE `activity` MODIFY `type` ENUM('photo','place','rating','edit','cover','comment','visit','bookmark','collection','collection_place') NOT NULL"
        );

        $this->db->simpleQuery(
            "ALTER TABLE `users_notifications` MODIFY `type` ENUM('photo','place','rating','comment','edit','cover','experience','level','achievements','visit','bookmark','collection_place') NOT NULL"
        );
    }

    public function down()
    {
        $this->db->simpleQuery(
            "ALTER TABLE `users_notifications` MODIFY `type` ENUM('photo','place','rating','comment','edit','cover','experience','level','achievements','visit','bookmark') NOT NULL"
        );

        $this->db->simpleQuery(
            "ALTER TABLE `activity` MODIFY `type` ENUM('photo','place','rating','edit','cover','comment','visit','bookmark') NOT NULL"
        );

        $this->forge->dropColumn('activity', 'collection_id');
    }
}
