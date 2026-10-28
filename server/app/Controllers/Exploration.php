<?php

namespace App\Controllers;

use App\Libraries\OsmScoring;
use App\Models\OsmCandidatesModel;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Exploration (features/25-visits-and-exploration.md, step 6): what is opened and what is not,
 * for the hex layer of the map. The browser bins the points into hexagons for its zoom, so
 * nothing is kept per cell on the server.
 *
 * @package App\Controllers
 */
class Exploration extends ResourceController
{
    /** Seconds the points are kept, in the server's cache and in the browser (GuestCache::$browserTtls says the same) */
    private const POINTS_TTL = 600;

    /**
     * Every published place and every open candidate of the tiers the map shows, as compact
     * points: `[lat, lon, category]`, coordinates rounded to ~100 m, no ids. ~14 000 points
     * today. Public; in the guest cache with a TTL (the candidates change without a write),
     * and `Cache-Control: max-age` (`GuestCache::$browserTtls`), so a visitor's browser asks once per visit.
     *
     * GET /exploration/points → { places: [[lat, lon, category], …], spots: [[lat, lon, category], …] }
     *
     * @return ResponseInterface
     */
    public function points(): ResponseInterface
    {
        // The answer is the same for everybody: the guest cache serves the guests, this one the
        // signed-in visitors (their requests carry the token and bypass it), with the same
        // max-age for the browser
        $body = cache()->remember('exploration_points', self::POINTS_TTL, static function (): string {
            $places = (new PlacesModel())
                ->asArray()
                ->select('lat, lon, category')
                ->findAll();

            $spots = (new OsmCandidatesModel())
                ->asArray()
                ->select('lat, lon, category')
                ->where('status', OsmCandidatesModel::STATUS_OPEN)
                ->whereIn('tier', [OsmScoring::TIER_KNOWN, OsmScoring::TIER_EXPLORE])
                ->findAll();

            $point = static fn (array $row): array => [round((float) $row['lat'], 3), round((float) $row['lon'], 3), $row['category'] ?: null];

            // Compact JSON whatever the environment's formatter does: 14 000 points are 400 KB this
            // way (~100 KB gzipped) and three times that pretty-printed
            return json_encode([
                'places' => array_map($point, $places),
                'spots'  => array_map($point, $spots),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        });

        return $this->response
            ->setContentType('application/json')
            ->removeHeader('Cache-Control')
            ->setHeader('Cache-Control', 'public, max-age=' . self::POINTS_TTL)
            ->setBody($body);
    }
}
