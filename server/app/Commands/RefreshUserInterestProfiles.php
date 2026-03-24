<?php

namespace App\Commands;

use App\Models\UserInterestProfilesModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

// php spark interests:refresh
class RefreshUserInterestProfiles extends BaseCommand
{
    protected $group       = 'interests';
    protected $name        = 'interests:refresh';
    protected $description = 'Refresh user interest profiles (categories and tags) based on activity';

    protected $arguments = [];

    protected $options = [
        '--user' => 'Optional user ID to refresh a single user',
    ];

    public function run(array $params)
    {
        $db     = \Config\Database::connect();
        $userId = CLI::getOption('user');

        if ($userId) {
            $users = [['id' => (string) $userId]];
            CLI::write("Refreshing interest profile for user: {$userId}");
        } else {
            // Query active users: those with activity_at within the last 30 days.
            // Falls back to all non-deleted users if none have recent activity.
            $rows = $db->query(
                'SELECT id FROM users
                  WHERE deleted_at IS NULL
                    AND activity_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
            )->getResultArray();

            if (empty($rows)) {
                $rows = $db->query(
                    'SELECT id FROM users WHERE deleted_at IS NULL'
                )->getResultArray();
            }

            $users = $rows;
            CLI::write('Refreshing interest profiles for ' . count($users) . ' user(s)...');
        }

        if (empty($users)) {
            CLI::write('No users found. Nothing to do.');
            return;
        }

        $model = new UserInterestProfilesModel();
        $processed = 0;

        foreach ($users as $user) {
            $model->refreshForUser((string) $user['id']);
            $processed++;
            
            if ($processed % 100 === 0) {
                CLI::write("Processed {$processed} users...");
            }
        }

        // Show summary statistics
        $stats = $db->query(
            'SELECT interest_type, COUNT(*) as count 
             FROM users_interest_profiles 
             GROUP BY interest_type'
        )->getResultArray();

        CLI::write('');
        CLI::write('User interest profiles refreshed successfully.');
        CLI::write("Total users processed: {$processed}");
        
        foreach ($stats as $stat) {
            CLI::write("  - {$stat['interest_type']} interests: {$stat['count']}");
        }
    }
}
