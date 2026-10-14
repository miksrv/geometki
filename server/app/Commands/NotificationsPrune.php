<?php

/**
 * Deletes notifications nobody needs any more:
 *  - toast-only ones ("+N XP" after the user's own action) older than a day, shown or not —
 *    they never appear in the notification list;
 *  - read notifications older than the given number of days (90 by default).
 *
 * Unread notifications are kept: they are what the user has not seen yet.
 *
 *   cd server
 *   php spark notifications:prune [days]
 *
 * Add to cron (daily):
 *   40 4 * * * cd /path/to/server && php spark notifications:prune >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Models\UsersNotificationsModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class NotificationsPrune extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'notifications:prune';
    protected $description = 'Delete toast-only notifications and old read notifications';
    protected $usage       = 'notifications:prune [days]';
    protected $arguments   = ['days' => 'Delete read notifications older than this many days (default 90)'];

    public function run(array $params)
    {
        $days  = max(1, (int) ($params[0] ?? 90));
        $total = (new UsersNotificationsModel())->deleteStale($days);

        CLI::write("Deleted $total stale notifications.", 'green');
    }
}
