<?php

namespace App\Controllers;

use App\Models\LocationRegionsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Regions controller
 *
 * Returns the full list of administrative regions used as place location references.
 *
 * @package App\Controllers
 */
class Regions extends ResourceController
{
    /**
     * Return all region records.
     *
     * GET /regions
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $regionsModel = new LocationRegionsModel();

        return $this->respond([
            'items'  => $regionsModel->findAll()
        ]);
    }
}