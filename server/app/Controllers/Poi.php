<?php

namespace App\Controllers;

use App\Libraries\Cluster;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Models\PhotosModel;
use App\Models\PlacesModel;
use App\Models\SessionsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

class Poi extends ResourceController {
    public function __construct()
    {
    }

    /**
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $categories = $this->request->getGet('categories', FILTER_SANITIZE_SPECIAL_CHARS);
        $zoom    = abs($this->request->getGet('zoom', FILTER_SANITIZE_NUMBER_INT) ?? 10);
        $author  = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS);
        $cluster = $this->request->getGet('cluster', FILTER_VALIDATE_BOOL);
        $bounds  = $this->_getBounds();

        $placesModel = new PlacesModel();
        $placesData  = $placesModel->select('id, category, lat, lon');

        if ($bounds) {
            $placesData->where([
                'lon >=' => $bounds[0],
                'lat >=' => $bounds[1],
                'lon <=' => $bounds[2],
                'lat <=' => $bounds[3],
            ]);
        }

        if (isset($categories)) {
            $placesData->whereIn('category', explode(',', $categories));
        }

        if ($author) {
            $placesData->where('user_id', $author);
        }

        $placesData  = $placesData->findAll();
        $totalPoints = count($placesData);

        if ($cluster === true) {
            $clusterData = new Cluster($placesData, $zoom);
            $resultData  = $clusterData->placeMarks;
        } else {
            $resultData  = $placesData;
        }

        return $this->respond([
            'count' => $totalPoints,
            'items' => $resultData
        ]);
    }


    /**
     * @return ResponseInterface
     */
    public function photos(): ResponseInterface
    {
        $zoom    = abs($this->request->getGet('zoom', FILTER_SANITIZE_NUMBER_INT) ?? 10);
        $locale  = $this->request->getLocale();
        $cluster = $this->request->getGet('cluster', FILTER_VALIDATE_BOOL);
        $bounds  = $this->_getBounds();

        $photosModel = new PhotosModel();
        $photosData  = $photosModel->select('place_id as placeId, lat, lon, filename, extension, title_en, title_ru');

        if ($bounds) {
            $photosData->where([
                'lon >=' => $bounds[0],
                'lat >=' => $bounds[1],
                'lon <=' => $bounds[2],
                'lat <=' => $bounds[3],
            ]);
        }

        $photosData = $photosData->groupBy('photos.lon, photos.lat')->findAll();

        $photosCount = count($photosData);

        if ($cluster === true) {
            $clusterData = new Cluster($photosData, $zoom);
            $resultData  = $clusterData->placeMarks;
        } else {
            $resultData  = $photosData;
        }

        foreach ($resultData as $photo) {
            if (isset($photo->type) && $photo->type === 'cluster') {
                continue;
            }

            $photoPath = PATH_PHOTOS . $photo->placeId . '/' . $photo->filename;

            $photo->full    = $photoPath . '.' . $photo->extension;
            $photo->preview = $photoPath . '_preview.' . $photo->extension;
            $photo->title   = $locale === 'ru' ?
                ($photo->title_ru ?: $photo->title_en) :
                ($photo->title_en ?: $photo->title_ru);

            unset($photo->title_ru, $photo->title_en, $photo->extension, $photo->filename);
        }

        return $this->respond([
            'count' => $photosCount,
            'items' => $resultData
        ]);
    }


    /**
     * @param $id
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $sessionLib   = new SessionLibrary();
        $placeContent = new PlacesContent();
        $placeContent->translate([$id]);

        if (!$placeContent->title($id)) {
            return $this->failNotFound();
        }

        $placesModel = new PlacesModel();
        $coordinates = $placesModel->makeDistanceSQL($sessionLib->lat, $sessionLib->lon);
        $placeData   = $placesModel
            ->select('id, rating, views, photos, photos, comments, bookmarks' . $coordinates)
            ->find($id);

        $placeData->title = $placeContent->title($id);

        if ($coordinates && !empty($placeData->distance)) {
            $placeData->distance = round((float) $placeData->distance, 1);
        }

        $formatter = new PlaceFormatterLibrary();
        $cover     = $formatter->formatCover($id, (int) $placeData->photos);
        if ($cover) {
            $placeData->cover = $cover;
        }

        return $this->respond($placeData);
    }


    /**
     * @return ResponseInterface
     */
    public function users(): ResponseInterface
    {
        $sessionsModel = new SessionsModel();
        $sessionsData  = $sessionsModel
            ->select('lat, lon')
            ->where(['lat !=' => null, 'lon !=' => null])
            ->findAll(500);

        if (!$sessionsData) {
            return $this->respond(['items' => []]);
        }

        foreach ($sessionsData as $key => $item) {
            $sessionsData[$key] = [$item->lat, $item->lon];
        }

        return $this->respond(['items' => $sessionsData]);
    }

    /**
     * Getting the map boundaries from the GET parameter
     * @return array|null
     */
    protected function _getBounds(): ?array
    {
        // left (lon), top (lat), right (lon), bottom (lat)
        $bounds = $this->request->getGet('bounds', FILTER_SANITIZE_SPECIAL_CHARS);

        if (empty($bounds) || !$bounds = explode(',', $bounds)) {
            return null;
        }

        if (count($bounds) !== 4) {
            return null;
        }

        return $bounds;
    }
}