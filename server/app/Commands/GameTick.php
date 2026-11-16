<?php

/**
 * The clock of the game (features/26-game-seasons-and-quests.md): closes the seasons whose
 * grace days are over — the table of each is frozen in `game_results`, so a photo or a visit
 * deleted later does not rewrite it, and the medals follow from the frozen places. Seasons are
 * made by hand, never here.
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
    protected $description = 'Close the seasons of the game that are over';

    public function run(array $params)
    {
        $closed = (new GameLibrary())->tick();

        CLI::write(
            $closed ? 'Closed: ' . implode(', ', $closed) : 'No season to close.',
            'green'
        );
    }
}
