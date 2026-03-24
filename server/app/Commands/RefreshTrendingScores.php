<?php

/**
 * Команда для обновления trending scores для всех мест.
 *
 * Запуск из командной строки:
 *   cd server
 *   php spark trending:refresh
 *
 * Для автоматического запуска добавьте в cron:
 *   0 * * * * cd /path/to/server && php spark trending:refresh >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Models\PlacesModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class RefreshTrendingScores extends BaseCommand
{
    protected $group       = 'trending';
    protected $name        = 'trending:refresh';
    protected $description = 'Refresh trending scores for all places';

    public function run(array $params)
    {
        $model = new PlacesModel();
        $model->refreshTrendingScores();

        CLI::write('Trending scores refreshed successfully.');
    }
}
