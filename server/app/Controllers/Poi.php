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

/**
 * Poi (Points of Interest) controller
 *
 * Supplies lightweight marker data for the map view: place pin list, photo
 * heat-map markers, a miniature place card, and online-user heatmap coordinates.
 * Optionally clusters markers server-side via the Cluster library.
 *
 * @package App\Controllers
 */
class Poi extends ResourceController
{
    /**
     * Return place markers for the map, optionally clustered.
     *
     * GET /poi — optional query params: categories, zoom, author, cluster, bounds.
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $categories = $this->request->getGet('categories', FILTER_SANITIZE_SPECIAL_CHARS);
        $zoom    = abs($this->request->getGet('zoom', FILTER_SANITIZE_NUMBER_INT) ?? 10);
        $author  = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS);
        $visited = $this->request->getGet('visited', FILTER_SANITIZE_SPECIAL_CHARS);
        $cluster = $this->request->getGet('cluster', FILTER_VALIDATE_BOOL);
        $bounds  = $this->getBounds();

        $placesModel = new PlacesModel();
        $placesData  = $placesModel->select('places.id, places.category, places.lat, places.lon');

        if ($bounds) {
            $placesData->where([
                'places.lon >=' => $bounds[0],
                'places.lat >=' => $bounds[1],
                'places.lon <=' => $bounds[2],
                'places.lat <=' => $bounds[3],
            ]);
        }

        if (isset($categories)) {
            $placesData->whereIn('places.category', explode(',', $categories));
        }

        if ($author) {
            $placesData->where('places.user_id', $author);
        }

        if ($visited) {
            $placesData->filterByVisitedUser($visited);
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
     * Return photo markers for the map, optionally clustered.
     *
     * GET /poi/photos — optional query params: zoom, cluster, bounds.
     *
     * @return ResponseInterface
     */
    public function photos(): ResponseInterface
    {
        $zoom    = abs($this->request->getGet('zoom', FILTER_SANITIZE_NUMBER_INT) ?? 10);
        $locale  = $this->request->getLocale();
        $cluster = $this->request->getGet('cluster', FILTER_VALIDATE_BOOL);
        $bounds  = $this->getBounds();

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
     * Return a miniature place card for the map popup.
     *
     * GET /poi/:id
     *
     * @param int|string|null $id Place primary key.
     *
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
     * Return current online-user coordinates for the heatmap layer.
     *
     * GET /poi/users — returns up to 500 [lat, lon] pairs from active sessions.
     *
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
     * Parse and validate the map bounding box from the GET `bounds` parameter.
     *
     * Expects four comma-separated floats: left lon, top lat, right lon, bottom lat.
     * Returns null when the parameter is absent, malformed, or out of geographic range.
     *
     * @return array|null Four-element float array [lonMin, latMax, lonMax, latMin],
     *                    or null when the bounds are invalid.
     */
    protected function getBounds(): ?array
    {
        // left (lon), top (lat), right (lon), bottom (lat)
        $bounds = $this->request->getGet('bounds', FILTER_SANITIZE_SPECIAL_CHARS);

        if (empty($bounds)) {
            return null;
        }

        $parts = array_map('floatval', explode(',', $bounds));

        if (count($parts) !== 4) {
            return null;
        }

        // Validate geographic ranges: lon in [-180,180], lat in [-90,90]
        // Order: left lon, top lat, right lon, bottom lat
        [$lonMin, $latMax, $lonMax, $latMin] = $parts;

        if (
            $lonMin < -180 || $lonMin > 180 ||
            $lonMax < -180 || $lonMax > 180 ||
            $latMin < -90  || $latMin > 90  ||
            $latMax < -90  || $latMax > 90
        ) {
            return null;
        }

        return $parts;
    }
}
