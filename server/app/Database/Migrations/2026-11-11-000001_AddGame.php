<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The game (features/26-game-seasons-and-quests.md): seasons and quests on top of the
 * confirmed visit.
 *
 *  - `users_visited_places.confirmed` (`photo` / `geo`), `confirmed_at`: a visit proved by a
 *    photo with EXIF (shot date and GPS near the place) or by "I am here" (the coordinates are
 *    compared and dropped); `hidden`: a visit of a riddle quest's point, kept out of the feed
 *    and the visitors of the place until the walk is over;
 *  - `photos.taken_at`, `photos.gps`: the shot moment from the EXIF and whether `lat` / `lon`
 *    are the photo's own (they fall back to the place's);
 *  - `game_seasons`: a season made by hand by an administrator — a random id like any other
 *    entity's (its page is `/game/seasons/{id}-{slug}`, the slug made from the title on the
 *    fly), its own dates (never overlapping), title and description in both languages, the
 *    medal of every participant (`medal_participant`) with its gold / silver / bronze variants
 *    for the places 1–3 —,
 *    `closed_at` and the totals once closed;
 *  - `game_points`: the score of a season — one row per person and place (`kind` = `place`) or
 *    walked quest (`quest`) with the points and how they were counted (`detail`);
 *  - `game_results`: the frozen table of a closed season;
 *  - `quests`, `quests_points`, `quests_walks`, `quests_walks_points`: a quest made by hand, its
 *    ordered places with hints, a person's walk and the points they confirmed. A quest has a
 *    mode (`open`, `steps`, `riddles`, `photos` — a riddle that is the first photo of the place),
 *    a search zone (`zone_lat`, `zone_lon`, `zone_radius`: a circle that holds every point, its
 *    centre moved off them, shown by a secret quest in place of its points; counted when the
 *    points are saved, QuestsLibrary::zoneOf()) and a medal (`medal`: the picture its walkers
 *    wear on their profile);
 *  - `places_outlines`: the outlines of large places (a lake, a park, a kremlin) from
 *    OpenStreetMap — "near the place" is near its outline too, not only near its point
 *    (GameLibrary::isNear()); one row per place that `php spark places:outlines` checked,
 *    `geometry` null when OSM has no fitting outline; and `places_lat_lon`, an index of the
 *    places by their position, for the neighbours of a place (GameLibrary::zoneOf());
 *  - no awards: those are made by hand in the admin. A season has no award of its own:
 *    taking part in it is seen from its score.
 *
 * MySQL commits every DDL statement on its own: each step checks whether it is still needed,
 * so running the migration again finishes a run that failed halfway.
 */
class AddGame extends Migration
{
    public function up()
    {
        $visits = 'users_visited_places';

        if (!$this->db->fieldExists('confirmed', $visits)) {
            $this->forge->addColumn($visits, [
                'confirmed'    => ['type' => 'VARCHAR', 'constraint' => 5, 'null' => true, 'after' => 'visited_at'],
                'confirmed_at' => ['type' => 'DATETIME', 'null' => true, 'after' => 'confirmed'],
                'hidden'       => ['type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 0, 'after' => 'confirmed_at'],
            ]);
        }

        if (!$this->db->fieldExists('taken_at', 'photos')) {
            $this->forge->addColumn('photos', [
                'taken_at' => ['type' => 'DATETIME', 'null' => true, 'after' => 'lon'],
                'gps'      => ['type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 0, 'after' => 'taken_at'],
            ]);
        }

        if (!$this->db->tableExists('game_seasons')) {
            $this->forge->addField([
                'id'                => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'title_ru'          => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => false, 'default' => ''],
                'title_en'          => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
                'description_ru'    => ['type' => 'TEXT', 'null' => true],
                'description_en'    => ['type' => 'TEXT', 'null' => true],
                'starts_on'         => ['type' => 'DATE', 'null' => false],
                'ends_on'           => ['type' => 'DATE', 'null' => false],
                // The medal of every participant (the season's one picture) and its variants for the places 1–3
                'medal_gold'        => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true],
                'medal_silver'      => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true],
                'medal_bronze'      => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true],
                'medal_participant' => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true],
                'closed_at'         => ['type' => 'DATETIME', 'null' => true],
                'players'           => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'places'            => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'created_at'        => ['type' => 'DATETIME', 'null' => true],
                'updated_at'        => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->addKey(['starts_on', 'ends_on'], false, false, 'game_seasons_dates');
            $this->forge->createTable('game_seasons');
        }

        if (!$this->db->tableExists('quests')) {
            $this->forge->addField([
                'id'             => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'mode'           => ['type' => 'ENUM("open","steps","riddles","photos")', 'null' => false, 'default' => 'open'],
                'status'         => ['type' => 'ENUM("draft","published")', 'null' => false, 'default' => 'draft'],
                'title_ru'       => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => false],
                'title_en'       => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
                'description_ru' => ['type' => 'TEXT', 'null' => true],
                'description_en' => ['type' => 'TEXT', 'null' => true],
                'medal'          => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
                'length_m'       => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'zone_lat'       => ['type' => 'DECIMAL', 'constraint' => '10,6', 'null' => true],
                'zone_lon'       => ['type' => 'DECIMAL', 'constraint' => '10,6', 'null' => true],
                'zone_radius'    => ['type' => 'INT', 'constraint' => 10, 'unsigned' => true, 'null' => true],
                'points'         => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'walked'         => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'user_id'        => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
                'created_at'     => ['type' => 'DATETIME', 'null' => true],
                'updated_at'     => ['type' => 'DATETIME', 'null' => true],
                'deleted_at'     => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->addKey(['status', 'deleted_at']);
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'SET NULL');
            $this->forge->createTable('quests');
        }

        if (!$this->db->tableExists('quests_points')) {
            $this->forge->addField([
                'id'       => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'quest_id' => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'place_id' => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'position' => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'hint_ru'  => ['type' => 'TEXT', 'null' => true],
                'hint_en'  => ['type' => 'TEXT', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->addUniqueKey(['quest_id', 'place_id'], 'quests_points_place');
            $this->forge->addKey(['quest_id', 'position']);
            $this->forge->addForeignKey('quest_id', 'quests', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('quests_points');
        }

        if (!$this->db->tableExists('quests_walks')) {
            $this->forge->addField([
                'id'          => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'quest_id'    => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'user_id'     => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'started_at'  => ['type' => 'DATETIME', 'null' => false],
                'finished_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->addUniqueKey(['quest_id', 'user_id'], 'quests_walks_user');
            $this->forge->addKey(['user_id', 'finished_at']);
            $this->forge->addForeignKey('quest_id', 'quests', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('quests_walks');
        }

        if (!$this->db->tableExists('quests_walks_points')) {
            $this->forge->addField([
                'walk_id'    => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'point_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'visit_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
                'created_at' => ['type' => 'DATETIME', 'null' => false],
            ]);
            $this->forge->addPrimaryKey(['walk_id', 'point_id']);
            $this->forge->addForeignKey('walk_id', 'quests_walks', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('point_id', 'quests_points', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('visit_id', $visits, 'id', 'CASCADE', 'SET NULL');
            $this->forge->createTable('quests_walks_points');
        }

        if (!$this->db->tableExists('game_points')) {
            $this->forge->addField([
                'id'         => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'season'     => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'user_id'    => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'kind'       => ['type' => 'ENUM("place","quest")', 'null' => false, 'default' => 'place'],
                'place_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
                'quest_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
                'visit_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
                'photo_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
                'way'        => ['type' => 'VARCHAR', 'constraint' => 5, 'null' => true],
                'points'     => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'detail'     => ['type' => 'TEXT', 'null' => true],
                'created_at' => ['type' => 'DATETIME', 'null' => false],
            ]);
            $this->forge->addPrimaryKey('id');
            // A place counts once a season for a person, a quest once (NULLs do not collide)
            $this->forge->addUniqueKey(['season', 'user_id', 'place_id'], 'game_points_place');
            $this->forge->addUniqueKey(['season', 'user_id', 'quest_id'], 'game_points_quest');
            $this->forge->addKey(['season', 'place_id']);
            $this->forge->addKey('user_id');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('quest_id', 'quests', 'id', 'CASCADE', 'CASCADE');
            // The score of a closed season stays when the visit or the photo goes: the rows of an
            // open one are deleted by GameLibrary
            $this->forge->addForeignKey('visit_id', $visits, 'id', 'CASCADE', 'SET NULL');
            $this->forge->addForeignKey('photo_id', 'photos', 'id', 'CASCADE', 'SET NULL');
            $this->forge->createTable('game_points');
        }

        if (!$this->db->tableExists('game_results')) {
            $this->forge->addField([
                'season'  => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'user_id' => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'place'   => ['type' => 'INT', 'unsigned' => true, 'null' => false],
                'points'  => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'places'  => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
                'quests'  => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0],
            ]);
            $this->forge->addPrimaryKey(['season', 'user_id']);
            $this->forge->addKey(['season', 'place']);
            $this->forge->addForeignKey('season', 'game_seasons', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('game_results');
        }

        // The neighbours of a place (GameLibrary::zoneOf()) are found by a box around it
        if (!$this->db->query("SHOW INDEX FROM places WHERE Key_name = 'places_lat_lon'")->getRow()) {
            $this->db->query('ALTER TABLE places ADD INDEX places_lat_lon (lat, lon)');
        }

        if (!$this->db->tableExists('places_outlines')) {
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
    }

    public function down()
    {
        $this->forge->dropTable('places_outlines', true);

        if ($this->db->query("SHOW INDEX FROM places WHERE Key_name = 'places_lat_lon'")->getRow()) {
            $this->db->query('ALTER TABLE places DROP INDEX places_lat_lon');
        }

        foreach (['game_results', 'game_points', 'quests_walks_points', 'quests_walks', 'quests_points', 'quests', 'game_seasons'] as $table) {
            $this->forge->dropTable($table, true);
        }

        foreach (['confirmed', 'confirmed_at', 'hidden'] as $column) {
            if ($this->db->fieldExists($column, 'users_visited_places')) {
                $this->forge->dropColumn('users_visited_places', $column);
            }
        }

        foreach (['taken_at', 'gps'] as $column) {
            if ($this->db->fieldExists($column, 'photos')) {
                $this->forge->dropColumn('photos', $column);
            }
        }
    }
}
