<?php

namespace App\Controllers;

use App\Models\PlacesModel;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Sitemap controller
 *
 * Returns the IDs and last-modified timestamps for all places and users,
 * consumed by the client to generate the XML sitemap.
 *
 * @package App\Controllers
 */
class Sitemap extends ResourceController
{
    /**
     * Return all place and user IDs with their last-updated timestamps.
     *
     * GET /sitemap
     *
     * @return ResponseInterface
     */
    public function index(): ResponseInterface
    {
        $placesModel = new PlacesModel();
        $usersModel  = new UsersModel();

        return $this->respond([
            'places' => $placesModel->select('id, updated_at as updated')->findAll(),
            'users'  => $usersModel->select('id, updated_at as updated')->findAll(),
        ]);
    }
}