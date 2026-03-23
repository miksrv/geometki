<?php

namespace App\Libraries;

use App\Models\PlacesModel;
use App\Models\RatingModel;
use App\Models\UsersModel;

class ReputationLibrary
{
    /**
     * Recalculate the reputation for a user based on ratings of their places,
     * persist the new value, and return it.
     *
     * Moved from Users::show() lines 96–121 (marked "TODO Separate this function to other library").
     *
     * @param string $userId
     * @return int  The computed reputation value (0 if user has no places).
     */
    public function recalculate(string $userId): int
    {
        $placesModel = new PlacesModel();
        $placesData  = $placesModel->select('id')->where('user_id', $userId)->findAll();

        if (empty($placesData)) {
            return 0;
        }

        $placesIds  = array_column($placesData, 'id');
        $ratingModel = new RatingModel();
        $ratingData  = $ratingModel->select('value')->whereIn('place_id', $placesIds)->findAll();

        $ratingValue = 0;

        if ($ratingData) {
            helper('rating');

            foreach ($ratingData as $ratingItem) {
                $ratingValue = $ratingValue + transformRating($ratingItem->value);
            }
        }

        $usersModel = new UsersModel();
        $usersModel->update($userId, ['reputation' => $ratingValue]);

        return $ratingValue;
    }
}
