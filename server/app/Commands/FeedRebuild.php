<?php

/**
 * Regroups the whole activity log into feed stories (App\Libraries\FeedLibrary::rebuild()).
 *
 * Run once after the AddFeed migration, and again whenever the grouping rules in
 * App\Libraries\FeedAggregator change. Safe to repeat: the feed is replaced in one
 * transaction; level stories (there is no level history to rebuild them from) are kept.
 *
 *   cd server
 *   php spark feed:rebuild
 */

namespace App\Commands;

use App\Libraries\FeedLibrary;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class FeedRebuild extends BaseCommand
{
    protected $group       = 'feed';
    protected $name        = 'feed:rebuild';
    protected $description = 'Regroup the activity log into feed stories';

    public function run(array $params)
    {
        $result = (new FeedLibrary())->rebuild();

        CLI::write(sprintf(
            'Feed rebuilt: %d events in %d stories, %d achievement stories.',
            $result['events'],
            $result['stories'],
            $result['achievements']
        ), 'green');
    }
}
