<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The activity feed as its own read model.
 *
 *  - `feed` holds the feed stories: one row per card ("added a place with 12 photos",
 *    "rated 5 places", "earned an achievement"). Activity rows are attached to a story
 *    when they are written (App\Libraries\FeedLibrary, rules in App\Libraries\FeedAggregator),
 *    so reading the feed is a single indexed query instead of grouping the log on the fly.
 *    Achievement and level stories have no activity rows: they are not user actions.
 *  - `activity` stays the log of user actions (place history, XP, achievements, digest,
 *    notifications) and gets `feed_id`, the story it belongs to.
 *  - `activity.views` is dropped: every feed request incremented it for every row shown,
 *    a write on each read for a number nobody needed.
 *  - Indexes for the reads that scanned the whole table: by time, by place and by author
 *    in time order, by collection. The unique `id` key duplicating the primary key goes.
 *
 * Existing activity is grouped into stories by `php spark feed:rebuild`, run once after
 * this migration (and any time the grouping rules change).
 *
 * MySQL commits every DDL statement on its own, so a run that fails halfway leaves part of
 * it done: each step checks whether it is still needed, and running the migration again
 * finishes it.
 */
class AddFeed extends Migration
{
    public function up()
    {
        if (!$this->db->tableExists('feed')) {
            $this->createFeedTable();
        }

        if ($this->db->fieldExists('views', 'activity')) {
            $this->forge->dropColumn('activity', 'views');
        }

        if (!$this->db->fieldExists('feed_id', 'activity')) {
            $this->forge->addColumn('activity', [
                'feed_id' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 15,
                    'null'       => true,
                    'after'      => 'id',
                ],
            ]);
        }

        $indexes = $this->indexNames('activity');

        if (in_array('id', $indexes, true)) {
            $this->db->simpleQuery('ALTER TABLE `activity` DROP INDEX `id`');
        }

        foreach (self::ACTIVITY_INDEXES as $name => $columns) {
            if (!in_array($name, $indexes, true)) {
                $this->db->simpleQuery("ALTER TABLE `activity` ADD INDEX `$name` ($columns)");
            }
        }
    }

    /** Indexes added to `activity`: name => columns */
    private const ACTIVITY_INDEXES = [
        'activity_created'       => '`created_at`',
        'activity_feed'          => '`feed_id`',
        'activity_place_created' => '`place_id`, `created_at`',
        'activity_user_created'  => '`user_id`, `created_at`',
        'activity_collection'    => '`collection_id`',
    ];

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

    private function createFeedTable(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'type' => [
                'type' => 'ENUM("place", "photo", "edit", "comment", "rating", "visit", "collection", "collection_place", "achievement", "level")',
                'null' => false,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'collection_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'achievement_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
            'level' => [
                'type'       => 'TINYINT',
                'constraint' => 3,
                'unsigned'   => true,
                'null'       => true,
            ],
            'weight' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'unsigned'   => true,
                'null'       => false,
                'default'    => 1,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['updated_at', 'id'], false, false, 'feed_updated');
        $this->forge->addKey(['user_id', 'updated_at'], false, false, 'feed_user_updated');
        $this->forge->addKey(['type', 'updated_at'], false, false, 'feed_type_updated');
        $this->forge->addKey(['weight', 'updated_at'], false, false, 'feed_weight_updated');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'feed_user_id_foreign');
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE', 'feed_place_id_foreign');
        $this->forge->addForeignKey('collection_id', 'collections', 'id', 'CASCADE', 'CASCADE', 'feed_collection_id_foreign');
        $this->forge->createTable('feed');
    }

    public function down()
    {
        $this->db->simpleQuery(
            'ALTER TABLE `activity`
                DROP INDEX `activity_created`,
                DROP INDEX `activity_feed`,
                DROP INDEX `activity_place_created`,
                DROP INDEX `activity_user_created`,
                DROP INDEX `activity_collection`,
                ADD UNIQUE INDEX `id` (`id`)'
        );

        $this->forge->dropColumn('activity', 'feed_id');

        $this->forge->addColumn('activity', [
            'views' => [
                'type'       => 'MEDIUMINT',
                'constraint' => 10,
                'null'       => false,
                'default'    => 0,
                'after'      => 'type',
            ],
        ]);

        $this->forge->dropTable('feed', true);
    }
}
