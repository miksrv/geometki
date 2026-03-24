<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\SessionLibrary;
use App\Libraries\ActivityLibrary;
use App\Models\PlacesModel;
use App\Models\RatingModel;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Exception;

class Rating extends ResourceController
{

    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Retrieves the rating history based on user ID or place ID.
     * TODO: Add userId implementation
     * @return ResponseInterface
     */
    public function history(): ResponseInterface
    {
        $paramUser  = $this->request->getGet('userId', FILTER_SANITIZE_SPECIAL_CHARS);
        $paramPlace = $this->request->getGet('placeId', FILTER_SANITIZE_SPECIAL_CHARS);

        if ($paramPlace && $paramUser) {
            return $this->failValidationErrors('Only one parameter is allowed (userId or placeId)');
        }

        if (!$paramPlace && !$paramUser) {
            return $this->failValidationErrors('Not enough data to get the rating history');
        }

        $ratingModel = new RatingModel();
        $ratingData  = $ratingModel
            ->select('value, user_id, rating.created_at' . ($paramPlace ? ', users.name, users.avatar' : ''));

        if ($paramUser) {
            $ratingData->where('user_id', $paramUser);
        }

        if ($paramPlace) {
            $ratingData
                ->join('users', 'rating.user_id = users.id', 'left')
                ->where('place_id', $paramPlace);
        }

        $data = $ratingData
            ->orderBy('rating.created_at', 'DESC')
            ->findAll();

        $avatarLibrary = new AvatarLibrary();
        foreach ($data as $item) {
            if (!empty($item->user_id)) {
                $item->author = [
                    'id'     => $item->user_id,
                    'name'   => $item->name,
                    'avatar' => $avatarLibrary->buildPath($item->user_id, $item->avatar, 'small'),
                ];
            }

            unset($item->user_id, $item->name, $item->avatar);
        }

        return $this->respond([
            'count' => count($data),
            'items' => $data
        ]);
    }

    /**
     * Returns the rating of the place by placeId
     * @param $id
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $ratingModel = new RatingModel();
        $ratingData  = $ratingModel->select('value, session_id, user_id')->where(['place_id' => $id])->findAll();
        $response    = ['rating' => 0, 'count'  => 0];

        if (!$ratingData) {
            return $this->respond($response);
        }

        $response['count'] = count($ratingData);

        foreach ($ratingData as $item) {
            if ($item->session_id === $this->session->id || $item->user_id === $this->session->user?->id) {
                $response['vote'] = $item->value;
            }

            $response['rating'] += $item->value;
        }

        $response['rating'] = round($response['rating'] / $response['count'], 1);

        return $this->respond($response);
    }

    /**
     * Adding a new rating
     * @return ResponseInterface
     */
    public function set(): ResponseInterface
    {
        try {
            $input = $this->request->getJSON();

            if (empty($input) || !$input->place || !(int) $input->score) {
                return $this->failValidationErrors('Not enough data to change the rating');
            }

            $ratingModel = new RatingModel();
            $placesModel = new PlacesModel();
            $usersModel  = new UsersModel();
            $placesData  = $placesModel->select('id, user_id, rating, updated_at')->find($input->place);
            $usersData   = $usersModel->select('id, reputation, updated_at')->find($placesData->user_id);
            $ratingData  = $ratingModel->where('place_id', $placesData->id)->findAll();

            $inputRating  = (int) $input->score;
            $alreadyVoted = null; // User changes their rating? We will store the rating record ID here
            $ratingValue  = abs($inputRating);

            if (!$placesData) {
                return $this->failNotFound();
            }

            helper('rating');

            // Let's calculate a new rating for the place
            if ($ratingData) {
                foreach ($ratingData as $item) {
                    if ($item->session_id === $this->session->id || $item->user_id === $this->session->user?->id) {
                        $alreadyVoted = $item->id;
                        continue;
                    }

                    $ratingValue += $item->value;
                }

                $ratingValue = $ratingValue
                    ? round($ratingValue / (count($ratingData) + ($alreadyVoted ? 0 : 1)), 1)
                    : null;
            }

            // Now let's change the author's reputation
            $userRating = $usersData->reputation + transformRating($inputRating);

            // We are creating a new rating model for saving
            $rating = new \App\Entities\RatingEntity();
            $rating->place_id   = $input->place;
            $rating->user_id    = $this->session->user?->id ?? null;
            $rating->session_id = $this->session->id;
            $rating->value      = $inputRating;

            $usersModel->update($placesData->user_id, ['reputation' => $userRating, 'updated_at' => $usersData->updated_at]);
            $placesModel->update($placesData->id, ['rating' => $ratingValue, 'updated_at' => $placesData->updated_at]);

            // Editing user rating
            if ($alreadyVoted) {
                $ratingModel->update($alreadyVoted, ['value' => $inputRating]);
                return $this->respondUpdated();
            }

            // Adding a new rating (the user has never voted yet)
            $ratingModel->insert($rating);

            /* ACTIVITY */
            $activity = new ActivityLibrary();
            $activity->owner($placesData->user_id)->rating($placesData->id, $ratingModel->getInsertID());

            return $this->respondCreated();
        } catch (Exception $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failNotFound();
        }
    }
}
