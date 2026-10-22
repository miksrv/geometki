<?php

/**
 * Deletes the authors' votes for their own places, then recalculates every user's
 * reputation: the shares of the votes on the places they made (App\Libraries\ReputationLibrary).
 *
 * The own votes are left from before Rating.ownPlace refused them. With each vote go its
 * activity (and by the foreign keys its notifications and queued emails); then the scores
 * of those places are recounted, the stories the votes were in are refreshed and the
 * authors' experience is recounted without them (ActivityRemoval), and the place pages are
 * rendered anew.
 *
 * Then brings everyone's experience and level in line with their activity (once: a profile
 * view used to recount them, now the removals do).
 *
 * Run once after deploying the fix that stopped a changed vote from adding its points
 * again, and whenever the reputation rules change. Safe to repeat. Back up the database
 * first: the votes and their activity are deleted for good.
 *
 *   cd server
 *   php spark reputation:rebuild --dry-run   # only count what would be deleted
 *   php spark reputation:rebuild
 */

namespace App\Commands;

use App\Libraries\ActivityRemoval;
use App\Libraries\LevelsLibrary;
use App\Libraries\ReputationLibrary;
use App\Libraries\SitePages;
use App\Models\UsersModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class ReputationRebuild extends BaseCommand
{
    protected $group       = 'users';
    protected $name        = 'reputation:rebuild';
    protected $description = 'Delete authors\' votes for their own places and recalculate every user\'s reputation';
    protected $usage       = 'reputation:rebuild [--dry-run]';
    protected $options     = ['--dry-run' => 'Only count the own votes and the experience off, change nothing'];

    public function run(array $params)
    {
        $reputation = new ReputationLibrary();
        $votes      = $reputation->findOwnVotes();
        $authorIds  = array_values(array_unique(array_column($votes, 'user_id')));
        $activities = count(array_filter(array_column($votes, 'activity_id')));

        CLI::write(sprintf(
            'Own votes: %d by %d authors on %d places, %d activity rows.',
            count(array_unique(array_column($votes, 'id'))),
            count($authorIds),
            count(array_unique(array_column($votes, 'place_id'))),
            $activities
        ));

        $dryRun = (bool) CLI::getOption('dry-run');

        if ($dryRun) {
            $this->syncExperience(true);

            CLI::write('Dry run: nothing changed.', 'yellow');

            return;
        }

        if ($votes) {
            // Collected while the votes' activity is still there
            $removal  = ActivityRemoval::forRatings(array_values(array_unique(array_column($votes, 'id'))));
            $placeIds = $reputation->deleteOwnVotes($votes);

            // The stories the votes were in, the voters' experience and the reputation around
            $removal->apply();

            CLI::write(sprintf('Deleted the own votes; recounted the scores of %d places, their stories and the authors\' experience.', count($placeIds)), 'green');

            foreach ($placeIds as $placeId) {
                SitePages::place($placeId);
            }

            SitePages::send();
        }

        $changed = $reputation->recalculateAll();

        CLI::write(sprintf('Reputation rebuilt: %d users changed.', $changed), 'green');

        $this->syncExperience(false);
    }

    /**
     * One-time: bring everyone's experience and level in line with their activity. A profile
     * view used to recount them and hid what the removals left off; the removals recount
     * them now (ActivityRemoval). Silent: no "new level" notifications.
     */
    private function syncExperience(bool $dryRun): void
    {
        $levels  = new LevelsLibrary();
        $users   = (new UsersModel())->select('id, experience, level')->findAll();
        $changed = 0;

        foreach ($users as $user) {
            $before = [(int) $user->experience, (int) $user->level];

            if ($dryRun) {
                $changed += $levels->experience($user->id) !== $before[0] ? 1 : 0;
                continue;
            }

            $levels->calculate($user, false);

            $changed += [(int) $user->experience, (int) $user->level] !== $before ? 1 : 0;
        }

        CLI::write(sprintf(
            $dryRun
                ? 'Experience: %d users of %d would change (at least: counted before the own votes go, their voters lose more).'
                : 'Experience synced: %d users of %d changed.',
            $changed,
            count($users)
        ), 'green');
    }
}
