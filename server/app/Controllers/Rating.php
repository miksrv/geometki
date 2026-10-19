<?php

namespace App\Controllers;

use App\Libraries\SessionLibrary;
use App\Libraries\ActivityLibrary;
use App\Libraries\SitePages;
use App\Models\PlacesModel;
use App\Models\RatingModel;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Throwable;

/**
 * Rating controller
 *
 * Handles place rating submission (1–5 stars) and updates the place's aggregate
 * rating and the author's reputation.
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
     * The vote belongs to this visitor: same session, or the same signed-in user.
     * A guest's null user id must not match other guests' votes.
     */
    private function isOwnVote(object $item): bool
    {
        $userId = $this->session->user?->id;

        return ($this->session->id !== null && $item->session_id === $this->session->id)
            || ($userId !== null && $item->user_id === $userId);
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
        // How many votes each score got, 1 to 5: the bars of the place page summary
        $response    = ['rating' => 0, 'count'  => 0, 'distribution' => [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0]];

        if (!$ratingData) {
            return $this->respond($response);
        }

        $response['count'] = count($ratingData);

        foreach ($ratingData as $item) {
            if ($this->isOwnVote($item)) {
                $response['vote'] = $item->value;
            }

            $value = (int) $item->value;

            if (isset($response['distribution'][$value])) {
                $response['distribution'][$value]++;
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

            // Rating your own place would feed your own reputation
            if ($this->session->user?->id && $this->session->user->id === $placesData->user_id) {
                return $this->failForbidden(lang('Rating.ownPlace'));
            }

            // A guest's first score starts their session (no visit starts one): it ties their
            // later scores to this one. Set on the request too, for the libraries below that
            // read the visitor's session again (ActivityLibrary), so they do not start another
            $newSession = null;

            if (!$this->session->isAuth && !$this->session->id) {
                $newSession = $this->session->update()->id;
                $this->request->setHeader('Session', $newSession);
            }

            helper('rating');

            // Let's calculate a new rating for the place
            if ($ratingData) {
                foreach ($ratingData as $item) {
                    if ($this->isOwnVote($item)) {
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
            SitePages::place($placesData->id);

            // Editing user rating
            if ($alreadyVoted) {
                $ratingModel->update($alreadyVoted, ['value' => $inputRating]);
                return $this->respondUpdated($newSession ? ['session' => $newSession] : null);
            }

            // Adding a new rating (the user has never voted yet)
            $ratingModel->insert($rating);

            /* ACTIVITY */
            $activity = new ActivityLibrary();
            $activity->owner($placesData->user_id)->rating($placesData->id, $ratingModel->getInsertID());

            return $this->respondCreated($newSession ? ['session' => $newSession] : null);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Rating.setError'));
        }
    }
}
