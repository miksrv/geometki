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
use Throwable;

/**
 * Rating controller
 *
 * Handles place rating submission (1–5 stars), updates the place's aggregate
 * rating and the author's reputation, and exposes the rating history for a
 * place or user.
 *
 * @package App\Controllers
 */
class Rating extends ResourceController
{

    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Return the rating history for a given place or user.
     *
     * GET /rating/history?placeId=:id or ?userId=:id — mutually exclusive params.
     *
     * @return ResponseInterface
     */
    public function history(): ResponseInterface
    {
        $paramUser  = $this->request->getGet('userId', FILTER_SANITIZE_SPECIAL_CHARS);
        $paramPlace = $this->request->getGet('placeId', FILTER_SANITIZE_SPECIAL_CHARS);

        if ($paramPlace && $paramUser) {
            return $this->failValidationErrors(lang('Rating.onlyOneParam'));
        }

        if (!$paramPlace && !$paramUser) {
            return $this->failValidationErrors(lang('Rating.missingParams'));
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
     * Return the aggregated rating and current session/user vote for a place.
     *
     * GET /rating/:id
     *
     * @param string|null $id Place primary key.
     *
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
     * Submit or update a star rating for a place.
     *
     * POST /rating/set
     * Expects JSON body with place (ID) and score (1–5).
     * Re-calculates the place aggregate rating and updates the author's reputation.
     *
     * @return ResponseInterface
     */
    public function set(): ResponseInterface
    {
        try {
            $input = $this->request->getJSON();

            if (empty($input) || !$input->place || !(int) $input->score) {
                return $this->failValidationErrors(lang('Rating.missingSetData'));
            }

            $ratingModel = new RatingModel();
            $placesModel = new PlacesModel();
            $usersModel  = new UsersModel();
            $placesData  = $placesModel->select('id, user_id, rating, updated_at')->find($input->place);
            $usersData   = $usersModel->select('id, reputation, updated_at')->find($placesData->user_id);
            $ratingData  = $ratingModel->where('place_id', $placesData->id)->findAll();

            $inputRating  = (int) $input->score;

            if ($inputRating < 1 || $inputRating > 5) {
                return $this->failValidationErrors(lang('Rating.scoreOutOfRange'));
            }

            $alreadyVoted = null; // User changes their rating? We will store the rating record ID here
            $ratingValue  = abs($inputRating);

            if (!$placesData) {
                return $this->failNotFound(lang('Rating.placeNotFound'));
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
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Rating.setError'));
        }
    }
}
