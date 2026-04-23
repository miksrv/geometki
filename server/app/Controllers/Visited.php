<?php

namespace App\Controllers;

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
 * toggle the visited status for any place.
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
     * Return the list of users who have marked the given place as visited.
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
        $visitedData  = $visitedModel
            ->select('users.id, users.name, users.avatar')
            ->join('users', 'users_visited_places.user_id = users.id', 'inner')
            ->where(['place_id' => $id])
            ->findAll();

        return $this->respond(['items' => $visitedData]);
    }

    /**
     * Toggle the visited status of a place for the authenticated user.
     *
     * POST /visited/set — auth required.
     * Expects JSON body with place (place ID).
     * Removes the visited record when it already exists; creates it otherwise.
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
            $insertData   = ['user_id' => $this->session->user?->id, 'place_id' => $input->place];
            $visitedModel = new UsersVisitedPlacesModel();
            $visitedData  = $visitedModel->where($insertData)->first();
            $placesModel  = new PlacesModel();
            $placesData   = $placesModel->find($input->place);

            if ($visitedData) {
                $visitedModel->delete($visitedData->id);

                return $this->respondDeleted();
            }

            if (!$placesData) {
                return $this->failNotFound(lang('Visited.placeNotFound'));
            }

            $visitedModel->insert($insertData);

            return $this->respondCreated();
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Visited.setError'));
        }
    }
}