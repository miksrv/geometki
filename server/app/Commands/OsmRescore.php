<?php

/**
 * Recalculates the scores of all OSM candidates from their stored tags,
 * e.g. after changing the rules in Config\OsmCandidates. Overpass is not asked.
 *
 * Запуск из командной строки:
 *   cd server
 *   php spark osm:rescore
 */

namespace App\Commands;

use App\Libraries\OsmCollector;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class OsmRescore extends BaseCommand
{
    protected $group       = 'osm';
    protected $name        = 'osm:rescore';
    protected $description = 'Recalculate the scores of OSM candidates from the stored tags';

    public function run(array $params)
    {
        $result = (new OsmCollector())->rescoreAll();

        CLI::write("Updated: {$result['updated']}, no longer candidates: {$result['gone']}");
    }
}
