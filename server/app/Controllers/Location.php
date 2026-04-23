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

/**
 * Location controller
 *
 * Provides location-related endpoints: updating user coordinates, searching
 * administrative entities (country/region/district/city) by text, performing
 * geocoder-based geo-search, and fetching a single location by type and ID.
 *
 * @package App\Controllers
 */
class Location extends ResourceController
{
    /**
     * Update the coordinates stored in the current user's session.
     *
     * POST /location/coordinates
     * Expects JSON body with lat and lon fields.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
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
     * Search countries, regions, districts, and cities by a text string.
     *
     * GET /location/search?text=:query
     *
     * @example http://localhost:8080/location/search?text=Орен
     *
     * @return ResponseInterface
     */
    public function search(): ResponseInterface
    {
        $result = [];
        $text   = $this->request->getGet('text');

        if (!$text || !is_string($text)) {
            return $this->respond([]);
        }

        $text = trim($text);

        $countriesData = $this->searchResult(new LocationCountriesModel(), $text);
        $regionsData   = $this->searchResult(new LocationRegionsModel(), $text);
        $districtsData = $this->searchResult(new LocationDistrictsModel(), $text);
        $citiesData    = $this->searchResult(new LocationLocalitiesModel(), $text);

        $result['countries'] = $this->prepareSearchData($countriesData);
        $result['regions']   = $this->prepareSearchData($regionsData);
        $result['districts'] = $this->prepareSearchData($districtsData);
        $result['cities']    = $this->prepareSearchData($citiesData);

        return $this->respond($result);
    }

    /**
     * Perform a free-text geocoder search via the configured geocoding provider.
     *
     * GET /location/geo-search?text=:query
     *
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function geoSearch(): ResponseInterface
    {
        $text = $this->request->getGet('text');

        if (!$text || !is_string($text)) {
            return $this->respond([]);
        }

        $text = trim($text);
        $geocoder = new Geocoder();

        return $this->respond(['items' => $geocoder->search($text)]);
    }

    /**
     * Return a single location entity by type and ID.
     *
     * GET /location/:id?type=country|region|district|locality
     *
     * @example http://localhost:8080/location/1?type=district
     *
     * @param int|string|null $id Location primary key.
     *
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
            return $this->showResult($countriesModel->find($id));
        }

        if ($type === 'region') {
            $regionsModel  = new LocationRegionsModel();
            return $this->showResult($regionsModel->find($id));
        }

        if ($type === 'district') {
            $districtsModel = new LocationDistrictsModel();
            return $this->showResult($districtsModel->find($id));
        }

        if ($type === 'locality') {
            $citiesModel = new LocationLocalitiesModel();
            return $this->showResult($citiesModel->find($id));
        }

        return $this->failValidationErrors('Unknown location type');
    }

    /**
     * Format and return a single location entity, resolving the locale-specific name.
     *
     * @param object|null $data Raw entity from the model, or null when not found.
     *
     * @return ResponseInterface
     */
    private function showResult(?object $data): ResponseInterface
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
     * Search a location model by text across English and Russian title columns.
     *
     * @param mixed  $locationModel Any of the location models (countries, regions, etc.).
     * @param string $text          The search string.
     *
     * @return array Matching entity rows.
     */
    private function searchResult(mixed $locationModel, string $text): array
    {
        return $locationModel->like('title_en', $text)->orLike('title_ru', $text)->findAll();
    }

    /**
     * Map raw location rows to a locale-aware response format.
     *
     * Resolves the localised name into a `name` field and removes the raw
     * title_en / title_ru fields from the output.
     *
     * @param array $data Raw rows from a location model.
     *
     * @return array Formatted location entries.
     */
    private function prepareSearchData(array $data): array
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
