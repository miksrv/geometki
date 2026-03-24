<?php

namespace App\Libraries;

use App\Models\LocationLocalitiesModel;
use App\Models\LocationCountriesModel;
use App\Models\LocationDistrictsModel;
use App\Models\LocationRegionsModel;
use Config\Services;
use Geocoder\Exception\Exception;
use Geocoder\Provider\Nominatim\Nominatim;
use Geocoder\Provider\Yandex\Yandex;
use Geocoder\Query\GeocodeQuery;
use Geocoder\Query\ReverseQuery;
use Geocoder\StatefulGeocoder;
use GuzzleHttp\Client;
use JetBrains\PhpStorm\NoReturn;
use ReflectionException;

 /**
  * Class Geocoder
  *
  * This class provides geocoding functionalities using different providers.
  * It can search for locations based on text or coordinates and retrieve detailed location data.
  *
  * @package App\Libraries
  * @link https://geocoder-php.org/docs/providers/nominatim/
  */
class Geocoder{
    /**
     * @var int|null $countryId The ID of the country.
     */
    public ?int $countryId = null;

    /**
     * @var int|null $regionId The ID of the region.
     */
    public ?int $regionId = null;

    /**
     * @var int|null $districtId The ID of the district.
     */
    public ?int $districtId = null;

    /**
     * @var int|null $localityId The ID of the locality.
     */
    public ?int $localityId = null;

    /**
     * @var string $addressEn The address in English.
     */
    public string $addressEn = '';

    /**
     * @var string $addressRu The address in Russian.
     */
    public string $addressRu = '';

    /**
     * @var Client $httpClient The HTTP client used for making requests.
     */
    private Client $httpClient;

    /**
     * @var \CodeIgniter\HTTP\IncomingRequest|\CodeIgniter\HTTP\CLIRequest $requestApi The request API.
     */
    private \CodeIgniter\HTTP\IncomingRequest|\CodeIgniter\HTTP\CLIRequest $requestApi;

    /**
     * @var Nominatim|Yandex $provider The geocoding provider.
     */
    private Nominatim|Yandex $provider;

    /**
     * @var string User-Agent string for Nominatim API requests
     */
    private const USER_AGENT = 'Geometki/1.0 (https://geometki.com)';

    /**
     * Geocoder constructor.
     * Initializes the HTTP client and request API, and sets the geocoding provider.
     */
    public function __construct()
    {
        $this->httpClient = new Client();
        $this->requestApi = Services::request();

        // Yandex clien was blocked :(
        // $this->provider   = new Yandex($this->httpClient, null, getenv('app.geocoder.yandexKey'));
        $this->provider   = Nominatim::withOpenStreetMapServer($this->httpClient, self::USER_AGENT);

       // $this->provider   = $this->requestApi->getLocale() === 'ru'
       //     ? new Yandex($this->httpClient, null, getenv('app.geocoder.yandexKey'))
       //     : Nominatim::withOpenStreetMapServer($this->httpClient, self::USER_AGENT);
    }

    /**
     * Searches for locations based on the provided text.
     *
     * @param string $text The text to search for locations.
     * @return array An array of location data including latitude, longitude, locality, country, region, district, and street.
     * @throws Exception If there is an error during geocoding.
     */
    public function search($text): array
    {
        $result    = [];
        $geocoder  = new StatefulGeocoder($this->provider, $this->requestApi->getLocale());
        $locations = $geocoder->geocodeQuery(GeocodeQuery::create($text))->all();

        if (empty($locations)) {
            return $result;
        }

        foreach ($locations as $location) {
            if (!$location->getLocality()) {
                continue;
            }

            $data  = [
                'lat' => $location->getCoordinates()->getLatitude(),
                'lon' => $location->getCoordinates()->getLongitude(),
                'locality' => $location->getLocality(),
            ];

            if ($location->getCountry()) {
                $data['country'] = $location->getCountry()->getName();
            }

            if ($location->getAdminLevels()->has(1)) {
                $data['region'] = $location->getAdminLevels()->get(1)->getName();
            }

            if ($location->getAdminLevels()->has(2)) {
                $data['district'] = $location->getAdminLevels()->get(2)->getName();
            }

            if ($location->getStreetName()) {
                $data['street'] = $location->getStreetName() . ($location->getStreetNumber() ? ', ' . $location->getStreetNumber() : '');
            }

            $result[] = $data;
        }

        return $result;
    }

    /**
     * Retrieves and processes location data based on provided coordinates.
     *
     * @param float $lat The latitude of the location.
     * @param float $lng The longitude of the location.
     * @param bool $changeProvider Flag to indicate if the provider should be changed in case of failure.
     * @return bool Returns true if the location data is successfully retrieved and processed, false otherwise.
     * @throws Exception If there is an error during geocoding.
     * @throws ReflectionException If there is an error during reflection.
     */
    public function coordinates(float $lat, float $lng, bool $changeProvider = false): bool
    {
        $geocoderEn = new StatefulGeocoder($this->provider, 'en');
        $geocoderRu = new StatefulGeocoder($this->provider, 'ru');
        $locationEn = $geocoderEn->reverseQuery(ReverseQuery::fromCoordinates($lat, $lng))->first();
        $locationRu = $geocoderRu->reverseQuery(ReverseQuery::fromCoordinates($lat, $lng))->first();

        $countryTitleEn = $locationEn->getCountry()?->getName();
        $countryTitleRu = $locationRu->getCountry()?->getName();

        // If the first geocoder cannot find the address, then connect the second one and try again
        if (!$countryTitleEn || !$countryTitleRu) {
            $this->provider = Nominatim::withOpenStreetMapServer($this->httpClient, self::USER_AGENT);

            // In order not to go into recursion, if we still cannot determine the address, we exit the function
            if ($changeProvider) {
                return false;
            }

            return $this->coordinates($lat, $lng, true);
        }

        $this->_getCountryId($countryTitleEn, $countryTitleRu);

        if ($locationEn->getAdminLevels()->has(1) && $locationRu->getAdminLevels()->has(1)) {
            $regionTitleEn = $locationEn->getAdminLevels()->get(1)->getName();
            $regionTitleRu = $locationRu->getAdminLevels()->get(1)->getName();
            $this->_getRegionId($regionTitleEn, $regionTitleRu);
        }

        if ($locationEn->getAdminLevels()->has(2) && $locationRu->getAdminLevels()->has(2)) {
            $districtTitleEn = $locationEn->getAdminLevels()->get(2)->getName();
            $districtTitleRu = $locationRu->getAdminLevels()->get(2)->getName();
            $this->_getDistrictId($districtTitleEn, $districtTitleRu);
        }

        $this->_getLocalityId($locationEn->getLocality(), $locationRu->getLocality());

        $this->addressEn = $locationEn->getStreetName() . ($locationEn->getStreetNumber() ? ', ' . $locationEn->getStreetNumber() : '');
        $this->addressRu = $locationRu->getStreetName() . ($locationRu->getStreetNumber() ? ', ' . $locationRu->getStreetNumber() : '');

        return true;
    }

    /**
     * Retrieves or creates the country ID based on the provided English and Russian titles.
     *
     * @param string $titleEn The English title of the country.
     * @param string $titleRu The Russian title of the country.
     * @return void
     * @throws ReflectionException If there is an error during reflection.
     */
    private function _getCountryId(
        string $titleEn,
        string $titleRu
    ): void
    {
        $countryModel = new LocationCountriesModel();
        $countryData  = $countryModel
            ->select('id')
            ->where([
                'title_en' => $titleEn,
                'title_ru' => $titleRu
            ])
            ->first();

        if ($countryData) {
            $this->countryId = $countryData->id;
            return;
        }

        $country = new \App\Entities\LocationCountryEntity();
        $country->title_en = $titleEn;
        $country->title_ru = $titleRu;

        $countryModel->insert($country);

        $this->countryId = $countryModel->getInsertID();
    }

    /**
     * Retrieves or creates the region ID based on the provided English and Russian titles.
     *
     * @param string $titleEn The English title of the region.
     * @param string $titleRu The Russian title of the region.
     * @return void
     * @throws ReflectionException If there is an error during reflection.
     */
    private function _getRegionId(
        string $titleEn,
        string $titleRu,
    ): void
    {
        if (!$this->countryId) {
            return;
        }

        $regionModel = new LocationRegionsModel();
        $regionData  = $regionModel
            ->select('id')
            ->where([
                'country_id' => $this->countryId,
                'title_en'   => $titleEn,
                'title_ru'   => $titleRu
            ])
            ->first();

        if ($regionData) {
            $this->regionId = $regionData->id;
            return;
        }

        $region = new \App\Entities\LocationRegionEntity();
        $region->country_id = $this->countryId;
        $region->title_en   = $titleEn;
        $region->title_ru   = $titleRu;

        $regionModel->insert($region);

        $this->regionId = $regionModel->getInsertID();
    }

    /**
     * Retrieves or creates the district ID based on the provided English and Russian titles.
     *
     * @param string $titleEn The English title of the district.
     * @param string $titleRu The Russian title of the district.
     * @return void
     * @throws ReflectionException If there is an error during reflection.
     */
    private function _getDistrictId(
        string $titleEn,
        string $titleRu,
    ): void
    {
        if (!$this->countryId || !$this->regionId) {
            return;
        }

        $districtModel = new LocationDistrictsModel();
        $districtData  = $districtModel
            ->select('id')
            ->where([
                'country_id' => $this->countryId,
                'region_id'  => $this->regionId,
                'title_en'   => $titleEn,
                'title_ru'   => $titleRu
            ])
            ->first();

        if ($districtData) {
            $this->districtId = $districtData->id;
            return;
        }

        $district = new \App\Entities\LocationDistrictEntity();
        $district->country_id = $this->countryId;
        $district->region_id  = $this->regionId;
        $district->title_en   = $titleEn;
        $district->title_ru   = $titleRu;

        $districtModel->insert($district);

        $this->districtId = $districtModel->getInsertID();
    }

    /**
     * Retrieves or creates the locality ID based on the provided English and Russian titles.
     *
     * @param string|null $titleEn The English title of the locality.
     * @param string|null $titleRu The Russian title of the locality.
     * @return void
     * @throws ReflectionException If there is an error during reflection.
     */
    private function _getLocalityId(
        ?string $titleEn,
        ?string $titleRu,
    ): void
    {
        if (!$titleEn && !$titleRu) {
            return;
        }

        $localityModel = new LocationLocalitiesModel();
        $localityData  = $localityModel
            ->select('id')
            ->where([
                'country_id'  => $this->countryId,
                'region_id'   => $this->regionId,
                'district_id' => $this->districtId,
                'title_en'    => $titleEn,
                'title_ru'    => $titleRu
            ])
            ->first();

        if ($localityData) {
            $this->localityId = $localityData->id;
            return;
        }

        $locality = new \App\Entities\LocationLocalityEntity();
        $locality->country_id  = $this->countryId;
        $locality->region_id   = $this->regionId;
        $locality->district_id = $this->districtId;
        $locality->title_en    = $titleEn;
        $locality->title_ru    = $titleRu;

        $localityModel->insert($locality);

        $this->localityId = $localityModel->getInsertID();
    }
}
