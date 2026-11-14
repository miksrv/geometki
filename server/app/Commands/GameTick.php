<?php

/**
 * The clock of the game (features/26-game-seasons-and-quests.md): makes sure the current
 * season and its award exist, and closes the seasons whose grace days are over — the table of
 * each is frozen in `game_results`, so a photo or a visit deleted later does not rewrite it.
 *
 *   cd server
 *   php spark game:tick
 *
 * Scheduled once a day; running it more often changes nothing.
 */

namespace App\Commands;

use App\Libraries\GameLibrary;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class GameTick extends BaseCommand
{
    protected $group       = 'game';
    protected $name        = 'game:tick';
    protected $description = 'Open the current season of the game and close the finished ones';

    public function run(array $params)
    {
        $closed = (new GameLibrary())->tick();

        CLI::write(
            $closed ? 'Closed: ' . implode(', ', $closed) : 'No season to close.',
            'green'
        );
    }
}
