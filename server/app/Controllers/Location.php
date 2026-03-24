<?php

namespace App\Controllers;

use App\Libraries\Geocoder;
use App\Libraries\SessionLibrary;
use App\Models\LocationLocalitiesModel;
use App\Models\LocationCountriesModel;
use App\Models\LocationDistrictsModel;
use App\Models\LocationRegionsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Geocoder\Exception\Exception;
use ReflectionException;

class Location extends ResourceController
{
    public function __construct()
    {
    }

    /**
     * Update user coordinates
     * @return ResponseInterface
     * @throws ReflectionException
     */
    public function coordinates(): ResponseInterface
    {
        $input = $this->request->getJSON();
        $lat = (float) $input->lat;
        $lon = (float) $input->lon;

        if ($lat && $lon) {
            $session = new SessionLibrary();
            $session->updateLocation($lat, $lon);
        }

        return $this->respondUpdated();
    }

    /**
     * @example http://localhost:8080/location/search?text=Орен
     * @return ResponseInterface
     */
    public function search(): ResponseInterface
    {
        $result = [];
        $text   = $this->request->getGet('text');

        if (!$text || !is_string($text)) {
            return $this->failValidationErrors('Please enter search string');
        }

        $text = trim($text);

        $countriesData = $this->_searchResult(new LocationCountriesModel(), $text);
        $regionsData   = $this->_searchResult(new LocationRegionsModel(), $text);
        $districtsData = $this->_searchResult(new LocationDistrictsModel(), $text);
        $citiesData    = $this->_searchResult(new LocationLocalitiesModel(), $text);

        $result['countries'] = $this->_prepareSearchData($countriesData);
        $result['regions']   = $this->_prepareSearchData($regionsData);
        $result['districts'] = $this->_prepareSearchData($districtsData);
        $result['cities']    = $this->_prepareSearchData($citiesData);

        return $this->respond($result);
    }

    /**
     * @throws Exception
     */
    public function geoSearch(): ResponseInterface
    {
        $text = $this->request->getGet('text');

        if (!$text || !is_string($text)) {
            return $this->failValidationErrors('Please enter search string');
        }

        $text = trim($text);
        $geocoder = new Geocoder();

        return $this->respond(['items' => $geocoder->search($text)]);
    }

    /**
     * @param $id
     * @example http://localhost:8080/location/1?type=district
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $location = ['country', 'region', 'district', 'locality'];
        $type     = $this->request->getGet('type', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!in_array($type, $location)) {
            return $this->failValidationErrors('Location type must be one of types: ' . implode(', ', $location));
        }

        if ($type === 'country') {
            $countriesModel = new LocationCountriesModel();
            return $this->_showResult($countriesModel->find($id));
        }

        if ($type === 'region') {
            $regionsModel  = new LocationRegionsModel();
            return $this->_showResult($regionsModel->find($id));
        }

        if ($type === 'district') {
            $districtsModel = new LocationDistrictsModel();
            return $this->_showResult($districtsModel->find($id));
        }

        if ($type === 'locality') {
            $citiesModel = new LocationLocalitiesModel();
            return $this->_showResult($citiesModel->find($id));
        }

        return $this->failValidationErrors('Unknown location type');
    }

    /**
     * @param object|null $data
     * @return ResponseInterface
     */
    private function _showResult(?object $data): ResponseInterface
    {
        if (!$data) {
            return $this->respond(null);
        }

        $result = $data;
        $locale = $this->request->getLocale();

        $result->name = $result->{"title_$locale"};
        unset($result->title_en, $result->title_ru);

        return $this->respond($result);
    }

    /**
     * @param $locationModel
     * @param string $text
     * @return mixed
     */
    private function _searchResult($locationModel, string $text): mixed
    {
        return $locationModel->like('title_en', $text)->orLike('title_ru', $text)->findAll();
    }

    /**
     * @param array $data
     * @return array
     */
    private function _prepareSearchData(array $data): array
    {
        $result = [];
        $locale = $this->request->getLocale();

        if ($data) {
            foreach ($data as $item) {
                $item->name = $item->{"title_$locale"};
                unset($item->title_en, $item->title_ru);

                $result[] = $item;
            }
        }

        return $result;
    }
}
