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

        $places = $placesModel->select('id, slug, updated_at as updated')->findAll();
        $users  = $usersModel->select('id, updated_at as updated')->findAll();

        foreach ([...$places, ...$users] as $row) {
            if (!empty($row->updated)) {
                $row->updated = new \DateTime((string) $row->updated);
            }
        }

        return $this->respond([
            'places' => $places,
            'users'  => $users,
        ]);
    }
}