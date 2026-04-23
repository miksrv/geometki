<?php

namespace App\Controllers;

use App\Models\LocationLocalitiesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Cities controller
 *
 * Provides the list of localities with their parent district, region, and country.
 *
 * @package App\Controllers
 */
class Cities extends ResourceController
{
    /**
     * Return all cities/localities joined with their administrative hierarchy.
     *
     * GET /cities
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $citiesModel = new LocationLocalitiesModel();
        $citiesData  = $citiesModel
            ->select(
                'address_city.*, address_district.name as district_name, 
                address_region.name as region_name, address_country.name as country_name')
            ->join('address_district', 'address_city.district = address_district.id', 'left')
            ->join('address_region', 'address_city.region = address_region.id', 'left')
            ->join('address_country', 'address_city.country = address_country.id', 'left')
            ->findAll();

        $response = [];

        if (empty($citiesData)) {
            return $this->respond(['items'  => $response]);
        }

        foreach ($citiesData as $locality) {
            $result = [
                'id'    => (int) $locality->id,
                'name'  => $locality->name,
            ];

            if ($locality->district_name) {
                $result['district'] = [
                    'id'   => $locality->district,
                    'name' => $locality->district_name,
                ];
            }

            if ($locality->region_name) {
                $result['region'] = [
                    'id'   => $locality->region,
                    'name' => $locality->region_name,
                ];
            }

            if ($locality->country_name) {
                $result['country'] = [
                    'id'   => $locality->country,
                    'name' => $locality->country_name,
                ];
            }

            $response[] = $result;
        }

        return $this->respond(['items'  => $response]);
    }
}