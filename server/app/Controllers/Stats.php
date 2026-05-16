<?php

namespace App\Controllers;

use App\Models\CommentsModel;
use App\Models\PhotosModel;
use App\Models\PlacesModel;
use App\Models\RatingModel;
use App\Models\UsersModel;
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
        $users    = new UsersModel();
        $photos   = new PhotosModel();
        $comments = new CommentsModel();
        $rating   = new RatingModel();

        return $this->respond([
            'places'  => $places->countAllResults(),
            'users'   => $users->countAllResults(),
            'photos'  => $photos->countAllResults(),
            'reviews' => $comments->countAllResults() + $rating->countAllResults(),
        ]);
    }
}
