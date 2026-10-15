<?php

/**
 * Deletes anonymous sessions nobody has used for a long time.
 *
 * A session is removed when it has no user, was last updated more than the given number of
 * days ago (90 by default) and left nothing behind: no ratings and no activity (both keep
 * `session_id` with ON DELETE RESTRICT). Signed-in users' sessions are kept.
 *
 *   cd server
 *   php spark sessions:prune [days]
 *
 * Not scheduled: run it by hand when the table has grown (once a year is plenty).
 */

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;

class SessionsPrune extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'sessions:prune';
    protected $description = 'Delete stale anonymous sessions that left no ratings or activity';
    protected $usage       = 'sessions:prune [days]';
    protected $arguments   = ['days' => 'Delete sessions not updated for this many days (default 90)'];

    private const BATCH = 5000;

    public function run(array $params)
    {
        $days = max(1, (int) ($params[0] ?? 90));
        $db   = Database::connect();
        $total = 0;

        do {
            $db->query(
                'DELETE FROM sessions
                 WHERE id IN (
                     SELECT id FROM (
                         SELECT s.id
                         FROM sessions s
                         WHERE s.user_id IS NULL
                           AND s.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                           AND NOT EXISTS (SELECT 1 FROM rating r WHERE r.session_id = s.id)
                           AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.session_id = s.id)
                         LIMIT ' . self::BATCH . '
                     ) stale
                 )',
                [$days]
            );

            $deleted = $db->affectedRows();
            $total  += $deleted;
        } while ($deleted === self::BATCH);

        CLI::write("Deleted $total stale anonymous sessions.", 'green');
    }
}
