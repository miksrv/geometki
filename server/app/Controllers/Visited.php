<?php

namespace App\Controllers;

use App\Libraries\SessionLibrary;
use App\Models\PlacesModel;
use App\Models\UsersVisitedPlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;

class Visited extends ResourceController
{
    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * @param $id
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
     * @return ResponseInterface
     * @throws ReflectionException
     */
    public function set(): ResponseInterface
    {
        $input = $this->request->getJSON();

        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (empty($input) || !$input->place) {
            return $this->failValidationErrors('Point of Interest ID missing');
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
                return $this->failNotFound();
            }

            $visitedModel->insert($insertData);

            return $this->respondCreated();
        } catch (Exception $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failNotFound();
        }
    }
}