<?php

/**
 * Run from CLI:
 *   php spark system:generate-users-online
 *
 * Add to cron:
 *   * * * * * cd /path/to/server && php spark system:generate-users-online >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Models\UsersModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use CodeIgniter\I18n\Time;

class GenerateUsersOnline extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'system:generate-users-online';
    protected $description = 'Simulate activity for internal geometki.com accounts';

    public function run(array $params)
    {
        $usersModel = new UsersModel();
        $usersData  = $usersModel->select('id, updated_at')->like('email', '%@geometki.com')->findAll();

        if (!$usersData) {
            return ;
        }

        $numItems   = ceil(count($usersData) * 0.3);
        $randomKeys = array_rand($usersData, $numItems);

        foreach ($randomKeys as $key) {
            $randomSeconds = rand(0, 5 * 60);
            $currentTime   = new Time("now -{$randomSeconds} seconds");

            $usersModel->update($usersData[$key]->id, [
                'updated_at'  => $usersData[$key]->updated_at,
                'activity_at' => $currentTime,
            ]);
        }

        CLI::write('Done.');
    }
}
