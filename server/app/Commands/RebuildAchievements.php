<?php

namespace App\Commands;

use App\Libraries\AchievementsLibrary;
use App\Libraries\LevelsLibrary;
use App\Models\UsersModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Throwable;

/**
 * Brings everyone's awards in line with the achievements as they are now, quietly: the awards
 * whose terms are no longer met are taken back (`AchievementsLibrary::reconcile()`: down to the
 * highest tier still met, or away, the stories leave the feed), the ones met but missing are
 * given (`evaluate()` without notifications and without feed stories), then the experience and
 * the level are recounted (they sum the awards held) — no notification, no push, no email, no
 * story in the feed at any step. An award given here has no story until `php spark
 * feed:rebuild`, which adds one for every award held without it (at its `earned_at`).
 *
 * Run once after the thresholds of achievements changed (an award given by an old, lower
 * threshold stays otherwise), and whenever the awards look out of step. Safe to repeat. Back up
 * the database first: an award taken back is deleted.
 *
 * Only the awards counting what a person can take back themselves are taken back (places,
 * visits, photos, reviews, quests…); the ones counting what moves by itself or days
 * (reputation, experience, level, days active, the run of days) stay earned once earned.
 *
 *   cd server
 *   php spark achievements:rebuild --dry-run       # only list what would be taken back
 *   php spark achievements:rebuild --user=abc123   # one person
 *   php spark achievements:rebuild
 */
class RebuildAchievements extends BaseCommand
{
    protected $group       = 'achievements';
    protected $name        = 'achievements:rebuild';
    protected $description = 'Quietly take back the awards no longer met, give the missing ones, recount the levels';
    protected $usage       = 'achievements:rebuild [--dry-run] [--user=<id>]';
    protected $options     = [
        '--dry-run' => 'Change nothing: list the awards that would be taken back',
        '--user'    => 'One person by ID',
    ];

    public function run(array $params): void
    {
        $dryRun  = array_key_exists('dry-run', $params) || CLI::getOption('dry-run');
        $userId  = $params['user'] ?? CLI::getOption('user');
        $library = new AchievementsLibrary();
        $levels  = new LevelsLibrary();
        $model   = new UsersModel();

        $query = $model->select('id, experience, level')->where('deleted_at IS NULL');

        if (is_string($userId) && $userId !== '') {
            $query->where('id', $userId);
        }

        $users = $query->findAll();

        CLI::write(($dryRun ? '[dry run] ' : '') . 'People: ' . count($users), 'yellow');

        $revoked = 0;
        $awarded = 0;
        $changed = 0;
        $errors  = 0;

        foreach ($users as $user) {
            try {
                if ($dryRun) {
                    $unmet = $library->unmet($user->id);

                    foreach ($unmet as $title) {
                        CLI::write("  {$user->id}: would take back «{$title}»");
                    }

                    $revoked += count($unmet);

                    continue;
                }

                // First taken back, then given: an award met again by its lower tier comes back as that tier
                $taken = $library->reconcile($user->id);
                $given = $library->evaluate($user->id, false, false);

                $revoked += count($taken);
                $awarded += count($given);

                if ($taken || $given) {
                    $changed++;
                    CLI::write("  {$user->id}: taken back " . count($taken) . ', given ' . count($given));
                }

                // Silent: no "new level" notification
                $levels->calculate($user, false);
            } catch (Throwable $e) {
                $errors++;
                CLI::write("  {$user->id}: " . $e->getMessage(), 'red');
            }
        }

        CLI::write(
            $dryRun
                ? "Would take back: {$revoked}. Missing awards are not counted by a dry run."
                : "Taken back: {$revoked}, given: {$awarded}, people changed: {$changed}, errors: {$errors}",
            $errors ? 'red' : 'green'
        );
    }
}
