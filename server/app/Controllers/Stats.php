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

/**
 * Stats controller
 *
 * Returns aggregated platform-wide counters for the homepage hero widget.
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
        ]);
    }
}
