<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Models\PlacesModel;
use App\Models\UsersVisitedPlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;
use Throwable;

/**
 * Visited controller
 *
 * Tracks which users have visited a place and allows authenticated users to
 * toggle the visited status for any place. Supports GPS-based visit verification
 * using the Haversine formula against each place's configured visit_radius_m.
 *
 * @package App\Controllers
 */
class Visited extends ResourceController
{
    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Check whether the authenticated user has visited the given place.
     *
     * GET /visited?placeId=:id
     *
     * @return ResponseInterface
     */
    public function check(): ResponseInterface
    {
        $placeId = $this->request->getGet('placeId', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$this->session->isAuth) {
            return $this->respond(['result' => false]);
        }

        if (!$placeId) {
            return $this->failValidationErrors(lang('Visited.missingPlaceId'));
        }

        $visitedModel = new UsersVisitedPlacesModel();
        $visitedData  = $visitedModel
            ->select('id')
            ->where(['user_id' => $this->session->user?->id, 'place_id' => $placeId])
            ->first();

        return $this->respond(['result' => !!$visitedData]);
    }

    /**
     * Return the list of users who have marked the given place as visited,
     * along with verified and total visit counts.
     *
     * GET /visited/place/:id
     *
     * @param string|null $id Place primary key.
     *
     * @return ResponseInterface
     */
    public function place($id = null): ResponseInterface
    {
        $visitedModel = new UsersVisitedPlacesModel();

        $avatarLibrary = new AvatarLibrary();

        $items = $visitedModel
            ->select('users.id, users.name, users.avatar')
            ->join('users', 'users_visited_places.user_id = users.id', 'inner')
            ->where(['place_id' => $id])
            ->findAll();

        $items = array_map(function ($item) use ($avatarLibrary) {
            $item->avatar = $avatarLibrary->buildPath($item->id, $item->avatar, 'small');
            return $item;
        }, $items);

        $verifiedCount = $visitedModel
            ->where(['place_id' => $id, 'verified' => 1])
            ->countAllResults();

        $totalCount = $visitedModel
            ->where(['place_id' => $id])
            ->countAllResults();

        return $this->respond([
            'items'          => $items,
            'verified_count' => $verifiedCount,
            'total_count'    => $totalCount,
        ]);
    }

    /**
     * Return a paginated list of places visited by the given user.
     *
     * GET /visited/user/:userId — public endpoint.
     * Optional query params: limit (default 21), offset (default 0).
     *
     * @param string|null $userId The user whose visited places are requested.
     *
     * @return ResponseInterface
     */
    public function user($userId = null): ResponseInterface
    {
        $limit  = abs((int) ($this->request->getGet('limit',  FILTER_SANITIZE_NUMBER_INT) ?? 21));
        $offset = abs((int) ($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0));

        $visitedModel = new UsersVisitedPlacesModel();
        $visitedData  = $visitedModel
            ->select('place_id')
            ->where('user_id', $userId)
            ->asArray()
            ->findAll();

        if (empty($visitedData)) {
            return $this->respond(['items' => [], 'count' => 0]);
        }

        $placeIds = array_column($visitedData, 'place_id');

        $locale = $this->request->getLocale();

        $placesModel = new PlacesModel();
        $placesModel->applyListSelect();

        $countModel = new PlacesModel();
        $countModel->applyListSelect();

        $placesCount = $countModel->whereIn('places.id', $placeIds)->countAllResults();

        $placesList = $placesModel
            ->whereIn('places.id', $placeIds)
            ->limit(min($limit, 40), $offset)
            ->get()
            ->getResult();

        $foundIds = array_column($placesList, 'id');

        $placeContent = new PlacesContent(350);
        $placeContent->translate($foundIds);

        $formatter = new PlaceFormatterLibrary();
        foreach ($placesList as $place) {
            $place->address   = $formatter->formatAddress($place, $locale);
            $place->rating    = (int) $place->rating;
            $place->views     = (int) $place->views;
            $place->photos    = (int) $place->photos;
            $place->comments  = (int) $place->comments;
            $place->bookmarks = (int) $place->bookmarks;
            $place->title     = $placeContent->title($place->id);
            $place->content   = strip_tags(html_entity_decode($placeContent->content($place->id), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $place->category  = $formatter->formatCategory($place, $locale);
            $place->author    = $formatter->formatAuthor($place);

            $cover = $formatter->formatCover($place->id, (int) $place->photos);
            if ($cover) {
                $place->cover = $cover;
            }

            $place->visitRadiusM       = (int) $place->visit_radius_m;
            $place->verificationExempt = (bool) $place->verification_exempt;

            $formatter->cleanupFields($place);
        }

        return $this->respond([
            'items' => $placesList,
            'count' => $placesCount,
        ]);
    }

    /**
     * Toggle the visited status of a place for the authenticated user.
     *
     * POST /visited/set — auth required.
     * Expects JSON body with: place (place ID), lat (optional), lon (optional).
     *
     * When the record already exists it is deleted and the response indicates
     * visited=false. When it does not exist a new record is created; if valid
     * coordinates are provided and the place is not verification_exempt, the
     * Haversine distance is compared against visit_radius_m to set verified.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function set(): ResponseInterface
    {
        $input = $this->request->getJSON();

        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (empty($input) || !$input->place) {
            return $this->failValidationErrors(lang('Visited.missingPlaceId'));
        }

        try {
            $whereData    = ['user_id' => $this->session->user?->id, 'place_id' => $input->place];
            $visitedModel = new UsersVisitedPlacesModel();
            $visitedData  = $visitedModel->where($whereData)->first();

            if ($visitedData) {
                $visitedModel->delete($visitedData->id);

                return $this->respond(['visited' => false, 'verified' => false]);
            }

            $placesModel = new PlacesModel();
            $placesData  = $placesModel->find($input->place);

            if (!$placesData) {
                return $this->failNotFound(lang('Visited.placeNotFound'));
            }

            $verified = false;

            $inputLat = $input->lat ?? null;
            $inputLon = $input->lon ?? null;

            if (
                $inputLat !== null && $inputLat !== '' &&
                $inputLon !== null && $inputLon !== '' &&
                $placesData->verification_exempt == 0
            ) {
                $distance = $this->haversineDistance(
                    (float) $inputLat,
                    (float) $inputLon,
                    (float) $placesData->lat,
                    (float) $placesData->lon
                );

                $verified = $distance <= $placesData->visit_radius_m;
            }

            $visitedModel->insert(array_merge($whereData, [
                'visited_at' => date('Y-m-d H:i:s'),
                'verified'   => $verified ? 1 : 0,
                'lat'        => $inputLat !== null && $inputLat !== '' ? (float) $inputLat : null,
                'lon'        => $inputLon !== null && $inputLon !== '' ? (float) $inputLon : null,
            ]));

            return $this->respondCreated(['visited' => true, 'verified' => $verified]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Visited.setError'));
        }
    }

    /**
     * Calculate the great-circle distance between two coordinates using the
     * Haversine formula.
     *
     * @param float $lat1 Latitude of point 1 in decimal degrees.
     * @param float $lon1 Longitude of point 1 in decimal degrees.
     * @param float $lat2 Latitude of point 2 in decimal degrees.
     * @param float $lon2 Longitude of point 2 in decimal degrees.
     *
     * @return float Distance in metres.
     */
    private function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R  = 6371000.0; // Earth's radius in metres

        $phi1   = deg2rad($lat1);
        $phi2   = deg2rad($lat2);
        $deltaPhi    = deg2rad($lat2 - $lat1);
        $deltaLambda = deg2rad($lon2 - $lon1);

        $a = sin($deltaPhi / 2) ** 2
            + cos($phi1) * cos($phi2) * sin($deltaLambda / 2) ** 2;

        $c = 2.0 * atan2(sqrt($a), sqrt(1.0 - $a));

        return $R * $c;
    }
}
