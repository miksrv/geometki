<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
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
