<?php

/**
 * Links the stored OSM candidates that are duplicates of our places (features/25, step 4):
 * a one-off for the candidates collected before the links were stored, harmless to repeat.
 *
 *   cd server
 *   php spark osm:link-duplicates
 */

namespace App\Commands;

use App\Models\OsmCandidatesModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;

class OsmLinkDuplicates extends BaseCommand
{
    protected $group       = 'osm';
    protected $name        = 'osm:link-duplicates';
    protected $description = 'Link the open OSM candidates that duplicate our places, tile by tile';

    public function run(array $params)
    {
        $model = new OsmCandidatesModel();

        // The automatic links of places moved away from their candidates go first
        $places = Database::connect()->query(
            'SELECT DISTINCT p.id, p.lat, p.lon
               FROM osm_candidates c
               JOIN places p ON p.id = c.place_id
              WHERE c.status = ? AND c.linked_by IS NULL',
            [OsmCandidatesModel::STATUS_LINKED]
        )->getResultArray();

        $reopened = 0;

        foreach ($places as $place) {
            $reopened += $model->reopenFarFrom($place['id'], (float) $place['lat'], (float) $place['lon']);
        }

        $tiles = Database::connect()->query(
            'SELECT MIN(lat) AS south, MIN(lon) AS west, MAX(lat) AS north, MAX(lon) AS east
               FROM osm_candidates
              WHERE status = ?
              GROUP BY tile_id',
            [OsmCandidatesModel::STATUS_OPEN]
        )->getResultArray();

        $linked = 0;

        foreach ($tiles as $tile) {
            $linked += $model->linkDuplicatesIn([(float) $tile['south'], (float) $tile['west'], (float) $tile['north'], (float) $tile['east']]);
        }

        CLI::write('Reopened: ' . $reopened . ', tiles: ' . count($tiles) . ', candidates linked: ' . $linked);
    }
}
