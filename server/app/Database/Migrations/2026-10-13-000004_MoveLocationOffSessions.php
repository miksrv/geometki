<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The visitor's location leaves the sessions.
 *
 *  - `sessions.lat` / `sessions.lon` and `sessions_history` go. The client asked for the
 *    position on every page and wrote it here; now it asks only when the visitor wants it
 *    (the map's "My location" button, sorting by distance) and passes it with the request.
 *    The `login_streak` achievement, which counted the days in `sessions_history` (so only for
 *    users who shared their location), now counts days with activity (AchievementsLibrary);
 *    its descriptions change from "log in N days in a row" to "be active N days in a row".
 *  - `users.last_lat` / `last_lon` / `last_location_at`: a signed-in user's last known
 *    position, saved by PUT /location when the user has moved (App\Models\UsersModel::
 *    updateLastLocation()). Not shown anywhere, kept for the explorer map
 *    (features/17-personal-fog-of-war-explorer-map.md). Filled from the latest session.
 *  - `sessions.user_ip` shrinks to 45 characters (the longest IPv6 text form), the unique
 *    `id` key duplicating the primary key goes, and `updated_at` gets indexes for the
 *    user's latest session and for `php spark sessions:prune`.
 *
 * MySQL commits every DDL statement on its own, so each step checks whether it is still
 * needed and running the migration again finishes a failed run. The dropped coordinates are
 * not restored by down().
 */
class MoveLocationOffSessions extends Migration
{
    public function up()
    {
        $this->updateStreakDescriptions('Be active %d days in a row', 'Будьте активны %d дней подряд');

        if (!$this->db->fieldExists('last_lat', 'users')) {
            $this->forge->addColumn('users', [
                'last_lat' => [
                    'type'  => 'DECIMAL(10,6)',
                    'null'  => true,
                    'after' => 'activity_at',
                ],
                'last_lon' => [
                    'type'  => 'DECIMAL(10,6)',
                    'null'  => true,
                    'after' => 'last_lat',
                ],
                'last_location_at' => [
                    'type'  => 'DATETIME',
                    'null'  => true,
                    'after' => 'last_lon',
                ],
            ]);
        }

        if ($this->db->fieldExists('lat', 'sessions')) {
            $this->db->query(
                'UPDATE users u
                 INNER JOIN (
                     SELECT s.user_id, s.lat, s.lon, s.updated_at
                     FROM sessions s
                     INNER JOIN (
                         SELECT user_id, MAX(updated_at) AS updated_at
                         FROM sessions
                         WHERE user_id IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL
                         GROUP BY user_id
                     ) latest ON latest.user_id = s.user_id AND latest.updated_at = s.updated_at
                     WHERE s.lat IS NOT NULL AND s.lon IS NOT NULL
                 ) last ON last.user_id = u.id
                 SET u.last_lat = last.lat, u.last_lon = last.lon, u.last_location_at = last.updated_at
                 WHERE u.last_lat IS NULL'
            );
        }

        if ($this->db->tableExists('sessions_history')) {
            $this->forge->dropTable('sessions_history');
        }

        if ($this->db->fieldExists('lat', 'sessions')) {
            $this->forge->dropColumn('sessions', ['lat', 'lon']);
        }

        $this->db->query('UPDATE sessions SET user_ip = LEFT(user_ip, 45) WHERE CHAR_LENGTH(user_ip) > 45');
        $this->forge->modifyColumn('sessions', [
            'user_ip' => [
                'type'       => 'VARCHAR',
                'constraint' => 45,
                'null'       => false,
            ],
        ]);

        $indexes = $this->indexNames('sessions');

        if (in_array('id', $indexes, true)) {
            $this->db->simpleQuery('ALTER TABLE `sessions` DROP INDEX `id`');
        }

        if (!in_array('sessions_user_updated', $indexes, true)) {
            $this->db->simpleQuery('ALTER TABLE `sessions` ADD INDEX `sessions_user_updated` (`user_id`, `updated_at`)');
        }

        if (!in_array('sessions_updated', $indexes, true)) {
            $this->db->simpleQuery('ALTER TABLE `sessions` ADD INDEX `sessions_updated` (`updated_at`)');
        }
    }

    public function down()
    {
        $this->updateStreakDescriptions('Log in %d days in a row', 'Заходите %d дней подряд');

        $indexes = $this->indexNames('sessions');

        foreach (['sessions_user_updated', 'sessions_updated'] as $name) {
            if (in_array($name, $indexes, true)) {
                $this->db->simpleQuery("ALTER TABLE `sessions` DROP INDEX `$name`");
            }
        }

        $this->forge->modifyColumn('sessions', [
            'user_ip' => [
                'type'       => 'VARCHAR',
                'constraint' => 300,
                'null'       => false,
            ],
        ]);

        if (!$this->db->fieldExists('lat', 'sessions')) {
            $this->forge->addColumn('sessions', [
                'lat' => ['type' => 'DECIMAL(10,6)', 'null' => true, 'after' => 'user_ip'],
                'lon' => ['type' => 'DECIMAL(10,6)', 'null' => true, 'after' => 'lat'],
            ]);
        }

        if (!$this->db->tableExists('sessions_history')) {
            $this->forge->addField([
                'id'         => ['type' => 'VARCHAR', 'constraint' => 32, 'null' => false, 'unique' => true],
                'session_id' => ['type' => 'VARCHAR', 'constraint' => 32, 'null' => false],
                'lat'        => ['type' => 'DECIMAL(10,6)', 'null' => false],
                'lon'        => ['type' => 'DECIMAL(10,6)', 'null' => false],
                'created_at DATETIME default current_timestamp',
                'updated_at DATETIME default current_timestamp',
                'deleted_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->addForeignKey('session_id', 'sessions', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('sessions_history');
        }

        if ($this->db->fieldExists('last_lat', 'users')) {
            $this->forge->dropColumn('users', ['last_lat', 'last_lon', 'last_location_at']);
        }
    }

    /** The `login_streak` achievements' texts, for each of their day thresholds */
    private function updateStreakDescriptions(string $en, string $ru): void
    {
        foreach ([7, 30, 60] as $days) {
            $this->db->table('achievements')
                ->like('rules', '"login_streak"')
                ->like('rules', '"value":' . $days . '}')
                ->update(['description_en' => sprintf($en, $days), 'description_ru' => sprintf($ru, $days)]);
        }
    }

    private function indexNames(string $table): array
    {
        return array_unique(array_column(
            $this->db->query("SHOW INDEX FROM `$table`")->getResultArray(),
            'Key_name'
        ));
    }
}
