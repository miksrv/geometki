<?php

namespace App\Controllers;

use App\Models\LocationCountriesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Countries controller
 *
 * Returns the full list of countries used as place location references.
 *
 * @package App\Controllers
 */
class Countries extends ResourceController
{
    /**
     * Return all country records.
     *
     * GET /countries
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $countriesModel = new LocationCountriesModel();

        return $this->respond([
            'items'  => $countriesModel->findAll()
        ]);
    }
}