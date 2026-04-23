<?php

namespace App\Controllers;

use App\Models\LocationDistrictsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Districts controller
 *
 * Returns the full list of administrative districts used as place location references.
 *
 * @package App\Controllers
 */
class Districts extends ResourceController
{
    /**
     * Return all district records.
     *
     * GET /districts
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $districtsModel = new LocationDistrictsModel();

        return $this->respond([
            'items'  => $districtsModel->findAll()
        ]);
    }
}