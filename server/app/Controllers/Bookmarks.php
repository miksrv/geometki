<?php

namespace App\Controllers;

use App\Libraries\SessionLibrary;
use App\Models\PlacesModel;
use App\Models\UsersBookmarksModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Throwable;

class Bookmarks extends ResourceController
{

    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Checks whether this place is already in the user's bookmarks or not
     * @return ResponseInterface
     */
    public function check(): ResponseInterface
    {
        $placeId = $this->request->getGet('placeId', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$this->session->isAuth) {
            return $this->respond(['result' => false]);
        }

        if (!$placeId) {
            return $this->failValidationErrors(lang('Bookmarks.missingPlaceId'));
        }

        $bookmarksModel = new UsersBookmarksModel();
        $bookmarkData   = $bookmarksModel
            ->select('id')
            ->where(['user_id' => $this->session->user?->id, 'place_id' => $placeId])
            ->first();

        return $this->respond(['result' => !!$bookmarkData]);
    }

    /**
     * Adds an interesting place to the user's bookmarks
     * @return ResponseInterface
     */
    public function set(): ResponseInterface
    {
        $input = $this->request->getJSON();

        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (empty($input) || !$input->placeId) {
            return $this->failValidationErrors(lang('Bookmarks.missingPlaceId'));
        }

        try {
            $bookmarkData   = ['user_id' => $this->session->user?->id, 'place_id' => $input->placeId];
            $bookmarksModel = new UsersBookmarksModel();
            $placesModel    = new PlacesModel();
            $bookmarksData  = $bookmarksModel->where($bookmarkData)->first();
            $placesData     = $placesModel->select('id')->find($input->placeId);

            if (!$placesData) {
                return $this->failNotFound(lang('Bookmarks.placeNotFound'));
            }

            if ($bookmarksData) {
                $bookmarksModel->delete($bookmarksData->id);
                $placesModel->decrementBookmarks($input->placeId);

                return $this->respondDeleted();
            }

            $bookmarksModel->insert($bookmarkData);

            // Update the bookmarks count
            $placesModel->incrementBookmarks($input->placeId);

            return $this->respondCreated();
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Bookmarks.setError'));
        }
    }
}