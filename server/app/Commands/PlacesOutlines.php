<?php

/**
 * Looks up the OSM outlines of large places (lakes, parks, kremlins) for "near the place" in
 * the game: the places of the categories with outlines (`Game::$outlineTags`) never checked, or
 * checked without luck long ago. One Overpass query or two per place, a pause between places;
 * when Overpass fails the run stops, the next one goes on.
 *
 * Запуск из командной строки:
 *   cd server
 *   php spark places:outlines                    # up to 30 places (cron, hourly)
 *   php spark places:outlines --limit 0          # every place left (the first fill)
 *   php spark places:outlines --place <id>       # one place, again
 *   php spark places:outlines --dry-run          # print, save nothing
 */

namespace App\Commands;

use App\Libraries\PlaceOutlines;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;
use Throwable;

class PlacesOutlines extends BaseCommand
{
    /** A place checked without an outline is checked again after this many days: OSM grows */
    private const RECHECK_DAYS = 90;

    /** Seconds between the places: public Overpass servers are shared */
    private const PAUSE = 2;

    protected $group       = 'places';
    protected $name        = 'places:outlines';
    protected $description = 'Look up the OSM outlines of large places for "near the place" in the game';
    protected $usage       = 'places:outlines [--limit 30] [--place <id>] [--dry-run]';
    protected $options     = [
        '--limit'   => 'Places at most, 0 — all (default 30)',
        '--place'   => 'Only this place, checked again',
        '--dry-run' => 'Print what is found, save nothing',
    ];

    public function run(array $params)
    {
        $outlines = new PlaceOutlines();
        $config   = config('Game');
        $limit    = (int) (CLI::getOption('limit') ?? 30);
        $placeId  = CLI::getOption('place');
        $dryRun   = CLI::getOption('dry-run') !== null;
        $db       = Database::connect();

        $builder = $db->table('places p')
            ->select('p.id, p.category, p.lat, p.lon, GROUP_CONCAT(pc.title SEPARATOR "\n") AS titles')
            ->join('places_content pc', 'pc.place_id = p.id', 'left')
            ->join('places_outlines o', 'o.place_id = p.id', 'left')
            ->where('p.deleted_at', null)
            ->groupBy('p.id, p.category, p.lat, p.lon')
            ->orderBy('p.created_at', 'DESC');

        if (is_string($placeId) && $placeId !== '') {
            $builder->where('p.id', $placeId);
        } else {
            $builder->whereIn('p.category', array_keys($config->outlineTags))
                ->groupStart()
                ->where('o.place_id', null)
                ->orGroupStart()
                ->where('o.source', null)
                ->where('o.checked_at <', date('Y-m-d H:i:s', strtotime('-' . self::RECHECK_DAYS . ' days')))
                ->groupEnd()
                ->groupEnd();

            if ($limit > 0) {
                $builder->limit($limit);
            }
        }

        $places = $builder->get()->getResult();
        $found  = 0;
        $failed = 0;

        foreach ($places as $index => $place) {
            if ($index > 0) {
                sleep(self::PAUSE);
            }

            $titles = array_values(array_filter(explode("\n", (string) $place->titles)));
            $line   = "{$place->id}\t{$place->category}\t" . ($titles[0] ?? '');

            try {
                $outline = $outlines->lookup($place, $titles);
            } catch (Throwable $e) {
                // Overpass is busy: the place and the rest stay unchecked, the next run takes them
                $failed = count($places) - $index;
                CLI::write("{$line}\tERROR " . mb_substr(strtok($e->getMessage(), "\n"), 0, 200), 'red');
                break;
            }

            if ($outline) {
                $found++;
                $size = round($outline['size'] / 1000, 1);
                CLI::write("{$line}\t{$outline['source']} «{$outline['name']}», {$size} km", 'green');
            } else {
                CLI::write("{$line}\t—");
            }

            if (!$dryRun) {
                PlaceOutlines::save($place->id, $outline);
            }
        }

        CLI::write(sprintf(
            'Places: %d, outlines: %d, none: %d, left for the next run: %d%s',
            count($places),
            $found,
            count($places) - $found - $failed,
            $failed,
            $dryRun ? ' (dry run, nothing saved)' : ''
        ));
    }
}
