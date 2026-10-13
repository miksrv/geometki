<?php

namespace App\Controllers;

use App\Libraries\OsmScoring;
use App\Models\CommentsModel;
use App\Models\OsmCandidatesModel;
use App\Models\PhotosModel;
use App\Models\PlacesModel;
use App\Models\RatingModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;

/**
 * Stats controller
 *
 * Returns aggregated platform-wide counters for the home page: the hero numbers and the
 * places count of every category (the category tiles).
 *
 * @package App\Controllers
 */
class Stats extends ResourceController
{
    /**
     * GET /stats
     *
     * @return ResponseInterface
     */
    public function index(): ResponseInterface
    {
        $places   = new PlacesModel();
        $photos   = new PhotosModel();
        $comments = new CommentsModel();
        $rating   = new RatingModel();

        return $this->respond([
            'places'     => $places->countAllResults(),
            // Interesting objects from OpenStreetMap that are not on Geometki yet:
            // the open candidates of the groups the map shows by default
            'unexplored' => (new OsmCandidatesModel())
                ->where('status', OsmCandidatesModel::STATUS_OPEN)
                ->whereIn('tier', [OsmScoring::TIER_KNOWN, OsmScoring::TIER_EXPLORE])
                ->countAllResults(),
            'photos'     => $photos->countAllResults(),
            'reviews'    => $comments->countAllResults() + $rating->countAllResults(),
            'categories' => $this->categoryCounts(),
        ]);
    }

    /**
     * Places per category, the fullest first. Only whitelisted keys: there is no category
     * table, a stray value must not become a tile.
     *
     * @return array<int, array{name: string, count: int}>
     */
    private function categoryCounts(): array
    {
        $rows = Database::connect()->table('places')
            ->select('category as name, COUNT(*) as count')
            ->where('deleted_at IS NULL', null, false)
            ->whereIn('category', config('Categories')->names)
            ->groupBy('category')
            ->orderBy('count', 'DESC')
            ->get()->getResult();

        return array_map(static fn ($row) => [
            'name'  => $row->name,
            'count' => (int) $row->count,
        ], $rows);
    }
}
