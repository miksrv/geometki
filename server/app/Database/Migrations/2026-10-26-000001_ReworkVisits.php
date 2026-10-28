<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Visits become a log (features/25-visits-and-exploration.md, step 1): a person can check in
 * at a place many times, one visit per day; the photos they upload that day are the visit's.
 *
 *  - `users_visited_places` keeps its name and rows; loses the visitor's location and the
 *    GPS verification (`verified`, `lat`, `lon`: the location is never kept, see "Visitor
 *    location" in CLAUDE.md) and gains `created_at`, `updated_at` and the indexes
 *    the place page and the profile timeline read by;
 *  - `places` loses `visit_radius_m` and `verification_exempt`;
 *  - `photos.visit_id`: a photo uploaded on the day of the uploader's visit belongs to the
 *    visit (its day is the visit's day); the photo stays when the visit goes;
 *  - `activity.visit_id`: the `visit` event of a visit, so deleting one visit removes its
 *    event alone (the activity row is soft-deleted by the controller, the key only clears
 *    the link); the events of the old visits are linked to them here, so those can be deleted
 *    the same way (one visit per user and place by the old rule);
 *  - one visit per user, place and moment is a unique key: the day is stored as noon, so two
 *    taps at once cannot make two visits of a day (`Visits::create()` answers the first one).
 *
 * MySQL commits every DDL statement on its own: each step checks whether it is still
 * needed, and running the migration again finishes a run that failed halfway.
 */
class ReworkVisits extends Migration
{
    public function up()
    {
        $visits = 'users_visited_places';

        foreach (['verified', 'lat', 'lon'] as $column) {
            if ($this->db->fieldExists($column, $visits)) {
                $this->forge->dropColumn($visits, $column);
            }
        }

        if (!$this->db->fieldExists('created_at', $visits)) {
            $this->forge->addColumn($visits, [
                'created_at' => [
                    'type'  => 'DATETIME',
                    'null'  => true,
                    'after' => 'visited_at',
                ],
                'updated_at' => [
                    'type'  => 'DATETIME',
                    'null'  => true,
                    'after' => 'created_at',
                ],
            ]);

            // The old rows were logged when they happened
            $this->db->query("UPDATE `{$visits}` SET `created_at` = `visited_at`, `updated_at` = `visited_at` WHERE `created_at` IS NULL");
        }

        $this->addIndex($visits, 'users_visited_places_place_day', '`place_id`, `visited_at`');
        $this->addIndex($visits, 'users_visited_places_user_day', '`user_id`, `visited_at`');

        if (!$this->hasIndex($visits, 'users_visited_places_moment')) {
            // Exact copies of a visit (a race of the old toggle): the first one stays, nothing points to the others yet
            $this->db->query(
                "DELETE v FROM `{$visits}` v
                   JOIN `{$visits}` o ON o.user_id = v.user_id AND o.place_id = v.place_id AND o.visited_at = v.visited_at AND o.id < v.id"
            );
            $this->db->query("ALTER TABLE `{$visits}` ADD UNIQUE INDEX `users_visited_places_moment` (`user_id`, `place_id`, `visited_at`)");
        }

        foreach (['visit_radius_m', 'verification_exempt'] as $column) {
            if ($this->db->fieldExists($column, 'places')) {
                $this->forge->dropColumn('places', $column);
            }
        }

        foreach (['photos' => 'SET NULL', 'activity' => 'SET NULL'] as $table => $onDelete) {
            if (!$this->db->fieldExists('visit_id', $table)) {
                $this->forge->addColumn($table, [
                    'visit_id' => [
                        'type'       => 'VARCHAR',
                        'constraint' => 15,
                        'null'       => true,
                        'after'      => 'place_id',
                    ],
                ]);
            }

            if (!isset($this->db->getForeignKeyData($table)["{$table}_visit_id_foreign"])) {
                $this->db->query(
                    "ALTER TABLE `{$table}` ADD CONSTRAINT `{$table}_visit_id_foreign`
                     FOREIGN KEY (`visit_id`) REFERENCES `{$visits}` (`id`) ON DELETE {$onDelete} ON UPDATE CASCADE"
                );
            }
        }

        // The `visit` events of the old visits: one visit per user and place by the old rule,
        // so the events of that pair are the visit's
        $this->db->query(
            "UPDATE `activity` a
               JOIN (SELECT user_id, place_id, MIN(id) AS id, COUNT(*) AS cnt FROM `{$visits}` GROUP BY user_id, place_id) v
                 ON v.user_id = a.user_id AND v.place_id = a.place_id AND v.cnt = 1
                SET a.visit_id = v.id
              WHERE a.type = 'visit' AND a.visit_id IS NULL"
        );
    }

    public function down()
    {
        $visits = 'users_visited_places';

        foreach (['photos', 'activity'] as $table) {
            if ($this->db->fieldExists('visit_id', $table)) {
                $this->forge->dropForeignKey($table, "{$table}_visit_id_foreign");
                $this->forge->dropColumn($table, 'visit_id');
            }
        }

        if (!$this->db->fieldExists('visit_radius_m', 'places')) {
            $this->forge->addColumn('places', [
                'visit_radius_m' => [
                    'type'       => 'SMALLINT',
                    'constraint' => 5,
                    'unsigned'   => true,
                    'null'       => false,
                    'default'    => 200,
                ],
                'verification_exempt' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'null'       => false,
                    'default'    => 0,
                ],
            ]);
        }

        // MySQL dropped the implicit indexes of the foreign keys when the composite ones above
        // covered them, and refuses to drop the last index a key stands on: the plain ones go back first
        $this->addIndex($visits, 'users_visited_places_place_id_foreign', '`place_id`');
        $this->addIndex($visits, 'users_visited_places_user_id_foreign', '`user_id`');

        foreach (['users_visited_places_place_day', 'users_visited_places_user_day', 'users_visited_places_moment'] as $index) {
            if ($this->hasIndex($visits, $index)) {
                $this->db->query("ALTER TABLE `{$visits}` DROP INDEX `{$index}`");
            }
        }

        foreach (['created_at', 'updated_at'] as $column) {
            if ($this->db->fieldExists($column, $visits)) {
                $this->forge->dropColumn($visits, $column);
            }
        }

        if (!$this->db->fieldExists('verified', $visits)) {
            $this->forge->addColumn($visits, [
                'verified' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'null'       => false,
                    'default'    => 0,
                    'after'      => 'visited_at',
                ],
                'lat' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,7',
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'verified',
                ],
                'lon' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,7',
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'lat',
                ],
            ]);
        }
    }

    private function addIndex(string $table, string $name, string $columns): void
    {
        if (!$this->hasIndex($table, $name)) {
            $this->db->query("ALTER TABLE `{$table}` ADD INDEX `{$name}` ({$columns})");
        }
    }

    private function hasIndex(string $table, string $name): bool
    {
        return isset($this->db->getIndexData($table)[$name]);
    }
}
