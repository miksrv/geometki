<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Index tuning.
 *
 *  - `places_views_log` gets `(view_date, place_id, count)`: the weekly views sort, the
 *    trending scores and the weekly digest take a date range, and the primary key
 *    `(place_id, view_date)` made each of them read the whole table (~1.2k rows a day).
 *  - The unique `id` keys duplicating the primary key go (as already done for `activity`
 *    and `sessions`).
 *  - Foreign key indexes that are the leading column of a composite index go: the
 *    composite one serves the foreign key.
 *
 * MySQL commits every DDL statement on its own, so each step checks whether it is still
 * needed and running the migration again finishes a failed run.
 */
class TuneIndexes extends Migration
{
    /** Tables whose unique `id` key duplicates the primary key */
    private const DUPLICATE_ID_TABLES = [
        'collections',
        'comments',
        'location_countries',
        'location_districts',
        'location_localities',
        'location_regions',
        'magic_link_tokens',
        'osm_candidates',
        'photos',
        'places',
        'places_tags',
        'rating',
        'sending_mail',
        'tags',
        'users',
        'users_bookmarks',
        'users_notifications',
        'users_visited_places',
    ];

    /** Foreign key indexes covered by a composite index: table => [index => column] */
    private const COVERED_FK_INDEXES = [
        'activity' => [
            'activity_place_id_foreign' => 'place_id',
            'activity_user_id_foreign'  => 'user_id',
        ],
        'sessions' => [
            'sessions_user_id_foreign' => 'user_id',
        ],
        'users_notifications' => [
            'users_notifications_user_id_foreign' => 'user_id',
        ],
    ];

    public function up()
    {
        if (!in_array('places_views_log_date_place', $this->indexNames('places_views_log'), true)) {
            $this->db->simpleQuery('ALTER TABLE `places_views_log` ADD INDEX `places_views_log_date_place` (`view_date`, `place_id`, `count`)');
        }

        foreach (self::DUPLICATE_ID_TABLES as $table) {
            if (in_array('id', $this->indexNames($table), true)) {
                $this->db->simpleQuery("ALTER TABLE `$table` DROP INDEX `id`");
            }
        }

        foreach (self::COVERED_FK_INDEXES as $table => $indexes) {
            $existing = $this->indexNames($table);

            foreach (array_keys($indexes) as $name) {
                if (in_array($name, $existing, true)) {
                    $this->db->simpleQuery("ALTER TABLE `$table` DROP INDEX `$name`");
                }
            }
        }
    }

    public function down()
    {
        foreach (self::COVERED_FK_INDEXES as $table => $indexes) {
            $existing = $this->indexNames($table);

            foreach ($indexes as $name => $column) {
                if (!in_array($name, $existing, true)) {
                    $this->db->simpleQuery("ALTER TABLE `$table` ADD INDEX `$name` (`$column`)");
                }
            }
        }

        foreach (self::DUPLICATE_ID_TABLES as $table) {
            if (!in_array('id', $this->indexNames($table), true)) {
                $this->db->simpleQuery("ALTER TABLE `$table` ADD UNIQUE INDEX `id` (`id`)");
            }
        }

        if (in_array('places_views_log_date_place', $this->indexNames('places_views_log'), true)) {
            $this->db->simpleQuery('ALTER TABLE `places_views_log` DROP INDEX `places_views_log_date_place`');
        }
    }

    /**
     * @return string[] Index names of the table
     */
    private function indexNames(string $table): array
    {
        return array_unique(array_column(
            $this->db->query("SHOW INDEX FROM `$table`")->getResultArray(),
            'Key_name'
        ));
    }
}
