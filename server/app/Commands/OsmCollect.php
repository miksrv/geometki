<?php

/**
 * Collects OSM candidates for the queued tiles.
 *
 * Запуск из командной строки:
 *   cd server
 *   php spark osm:collect [--limit 5]
 *
 * Для автоматического запуска добавьте в cron (раз в минуту):
 *   * * * * * cd /path/to/server && php spark osm:collect >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Libraries\OsmCollector;
use App\Models\OsmTilesModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Throwable;

class OsmCollect extends BaseCommand
{
    protected $group       = 'osm';
    protected $name        = 'osm:collect';
    protected $description = 'Collect OSM candidates for the queued tiles';
    protected $usage       = 'osm:collect [--limit N]';
    protected $options     = ['--limit' => 'Max tiles in this run (default: config tilesPerRun)'];

    public function run(array $params)
    {
        $config    = config('OsmCandidates');
        $tiles     = new OsmTilesModel();
        $collector = new OsmCollector($config);
        $limit     = (int) (CLI::getOption('limit') ?: $config->tilesPerRun);

        $tiles->prepareQueue($config);

        for ($done = 0; $done < $limit; $done++) {
            $tile = $tiles->claimNext();

            if (!$tile) {
                break;
            }

            // Be polite to the public Overpass servers
            if ($done > 0) {
                sleep($config->pauseSeconds);
            }

            $startedAt = microtime(true);

            try {
                $count = $collector->collectTile($tile);
                $tiles->markDone($tile->id, $count, $config);

                $skipped = array_sum($collector->skipped);
                $seconds = round(microtime(true) - $startedAt, 1);
                $steps   = implode(', ', array_map(
                    static fn ($step, $time) => "{$step} {$time}",
                    array_keys($collector->timings),
                    $collector->timings
                ));

                CLI::write(
                    "Tile {$tile->tile_lat}:{$tile->tile_lon}: {$count} candidates, {$skipped} skipped, "
                    . "Wikidata {$collector->glued} glued + {$collector->wikidataOnly} new, {$seconds} s ({$steps})"
                );
            } catch (Throwable $e) {
                $tiles->markFailed($tile, $e->getMessage(), $config);
                // Not logged: the public sources fail often, the tile keeps its last error and retries itself
                CLI::error("Tile {$tile->tile_lat}:{$tile->tile_lon} failed: {$e->getMessage()}");
            }
        }

        if ($done === 0) {
            CLI::write('No tiles in the queue.');
        }
    }
}
