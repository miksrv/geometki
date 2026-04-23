<?php

namespace App\Controllers;

use App\Models\PlacesModel;
use App\Models\SendingMail;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;

/**
 * Mail controller
 *
 * Handles email preference management, specifically the one-click unsubscribe
 * flow triggered by links embedded in outgoing notification and digest emails.
 *
 * @package App\Controllers
 */
class Mail extends ResourceController
{
    /**
     * Process a one-click unsubscribe request.
     *
     * GET /mail/unsubscribe?mail=:id
     * Looks up the sending_mail record by ID, then disables the matching email
     * preference in the recipient's user settings. Handles both digest emails
     * (no activity_id) and activity notification emails.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function unsubscribe(): ResponseInterface
    {
        $mail = $this->request->getGet('mail', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$mail) {
            return $this->failValidationErrors(lang('Mail.emptyParameters'));
        }

        $sendingEmailModel = new SendingMail();
        $sendingEmailData  = $sendingEmailModel
            ->select('sending_mail.id, sending_mail.email, activity_id, activity.place_id, activity.type')
            ->join('activity', 'activity.id = sending_mail.activity_id', 'left')
            ->find($mail);

        if (!$sendingEmailData) {
            return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
        }

        // --- Scenario 1: Digest email (activity_id is NULL) ---
        if (empty($sendingEmailData->activity_id)) {
            $userModel = new UsersModel();
            // Find user by email from the sending_mail record
            $userData  = $userModel
                ->select('id, settings, updated_at')
                ->where('email', $sendingEmailData->email)
                ->first();

            if (!$userData) {
                return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
            }

            $settings = $userData->settings ?? (object) [
                'emailComment' => true,
                'emailEdit'    => true,
                'emailPhoto'   => true,
                'emailRating'  => true,
                'emailCover'   => true,
                'emailDigest'  => true,
            ];

            $settings->emailDigest = false;

            $userModel->update($userData->id, [
                'settings'   => json_encode($settings),
                'updated_at' => $userData->updated_at,
            ]);

            return $this->respond(lang('Mail.successMessage'));
        }

        // --- Scenario 2: Activity notification email ---
        $placeModel = new PlacesModel();
        $userModel  = new UsersModel();
        $placeData  = $placeModel->select('user_id')->find($sendingEmailData->place_id);

        if (!$placeData) {
            return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
        }

        $userData   = $userModel->select('id, settings, updated_at')->find($placeData->user_id);

        if (!$userData) {
            return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
        }

        $configItem = $this->mapActivityType($sendingEmailData->type);

        // If settings is null, create default settings object
        $settings = $userData->settings ?? (object) [
            'emailComment' => true,
            'emailEdit'    => true,
            'emailPhoto'   => true,
            'emailRating'  => true,
            'emailCover'   => true,
        ];

        if ($configItem) {
            $settings->{$configItem} = false;
        }

        $userModel->update($userData->id, ['settings' => json_encode($settings), 'updated_at' => $userData->updated_at]);

        return $this->respond(lang('Mail.successMessage'));
    }

    /**
     * Map an activity type string to the corresponding user settings key.
     *
     * @param string $activityType Raw activity type (e.g. 'comment', 'photo').
     *
     * @return string The settings property name, or an empty string when unknown.
     */
    protected function mapActivityType(string $activityType): string
    {
        return match ($activityType) {
            'comment' => 'emailComment',
            'edit'    => 'emailEdit',
            'photo'   => 'emailPhoto',
            'rating'  => 'emailRating',
            'cover'   => 'emailCover',

            default => '',
        };
    }
}
