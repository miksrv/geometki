<?php

/**
 * EvaluateAchievements Command
 *
 * CLI command for evaluating and awarding achievements to users based on their
 * activity and statistics. Can be run manually or scheduled via cron.
 *
 * Usage:
 *   php spark achievements:evaluate              # Evaluate users active in last 24h
 *   php spark achievements:evaluate --all        # Evaluate ALL users
 *   php spark achievements:evaluate --user=abc123 # Evaluate single user by ID
 *   php spark achievements:evaluate --no-notify  # Skip notifications
 *
 * Cron example (runs every hour for recently active users):
 *   0 * * * * cd /path/to/server && php spark achievements:evaluate >> /dev/null 2>&1
 *
 * Daily full evaluation (runs at 3 AM):
 *   0 3 * * * cd /path/to/server && php spark achievements:evaluate --all >> /dev/null 2>&1
 *
 * @package    App\Commands
 * @author     Geometki
 * @since      1.0.0
 */

namespace App\Commands;

use App\Libraries\AchievementsLibrary;
use App\Models\UsersModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Class EvaluateAchievements
 *
 * Evaluates user achievements based on their activity metrics (places added,
 * photos uploaded, ratings given, etc.) and awards new achievements when
 * thresholds are met.
 *
 * The command supports three modes:
 * - Default: Only processes users who were active in the last 24 hours
 * - All: Processes all non-deleted users in the database
 * - Single: Processes a specific user by their ID
 *
 * @package App\Commands
 */
class EvaluateAchievements extends BaseCommand
{
    /** @var string Command group for categorization */
    protected $group       = 'achievements';

    /** @var string Command name used in CLI */
    protected $name        = 'achievements:evaluate';

    /** @var string Short description shown in help */
    protected $description = 'Evaluate and award achievements for users';

    /** @var string Usage syntax */
    protected $usage       = 'achievements:evaluate [--all] [--user=<id>] [--no-notify]';

    /** @var array<string, string> Available command options */
    protected $options     = [
        '--all'       => 'Evaluate all users (default: only users active in last 24h)',
        '--user'      => 'Evaluate a single user by ID',
        '--no-notify' => 'Skip sending notifications when awarding achievements',
    ];

    /**
     * Execute the achievements evaluation command.
     *
     * Processes users based on provided options and outputs statistics
     * about awarded achievements and any errors encountered.
     *
     * @param array<string, mixed> $params Command line parameters
     *
     * @return void
     */
    public function run(array $params): void
    {
        $all      = array_key_exists('all', $params);
        $userId   = $params['user'] ?? null;
        $noNotify = array_key_exists('no-notify', $params);

        $usersModel      = new UsersModel();
        $achievementsLib = new AchievementsLibrary();

        // --- Single user mode ---
        if ($userId) {
            CLI::write("Evaluating achievements for user: {$userId}", 'yellow');

            $user = $usersModel->find($userId);

            if (!$user) {
                CLI::write("User not found: {$userId}", 'red');
                return;
            }

            $awarded = $achievementsLib->evaluate($userId);

            CLI::write(
                "User {$userId}: " . count($awarded) . " achievement(s) awarded.",
                count($awarded) > 0 ? 'green' : 'yellow'
            );

            return;
        }

        // --- Bulk mode ---
        if ($all) {
            CLI::write('Evaluating achievements for ALL users...', 'yellow');
            $users = $usersModel
                ->select('id')
                ->where('deleted_at IS NULL')
                ->findAll();
        } else {
            CLI::write('Evaluating achievements for users active in the last 24 hours...', 'yellow');
            $users = $usersModel
                ->select('id')
                ->where('activity_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)')
                ->where('deleted_at IS NULL')
                ->findAll();
        }

        if (empty($users)) {
            CLI::write('No users to evaluate.', 'yellow');
            return;
        }

        CLI::write('Processing ' . count($users) . ' user(s)...', 'cyan');

        $totalAwarded  = 0;
        $totalErrors   = 0;
        $processedCount = 0;

        foreach ($users as $user) {
            try {
                $awarded = $achievementsLib->evaluate($user->id);
                $totalAwarded += count($awarded);

                if (count($awarded) > 0) {
                    CLI::write(
                        "  User {$user->id}: +" . count($awarded) . " achievement(s)",
                        'green'
                    );
                }
            } catch (\Throwable $e) {
                log_message('error', 'AchievementsEvaluate error for user {userId}: {message}', [
                    'userId'  => $user->id,
                    'message' => $e->getMessage(),
                ]);
                $totalErrors++;
            }

            $processedCount++;
        }

        CLI::write('Evaluation complete.', 'green');
        CLI::write('  Processed : ' . $processedCount, 'cyan');
        CLI::write('  Awarded   : ' . $totalAwarded, 'green');
        CLI::write('  Errors    : ' . $totalErrors, $totalErrors > 0 ? 'red' : 'green');
    }
}
