<?php

namespace App\Controllers;

use App\Models\PlacesModel;
use App\Models\SendingMail;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;

class Mail extends ResourceController
{
    public function __construct()
    {
    }

    /**
     * @return ResponseInterface
     * @throws ReflectionException
     */
   public function unsubscribe(): ResponseInterface
   {
       // --- Scenario 1: unsubscribe from digest by user_id ---
       $digestUserId = $this->request->getGet('digest', FILTER_SANITIZE_SPECIAL_CHARS);
       if ($digestUserId) {
           $userModel = new UsersModel();
           $userData  = $userModel->select('id, settings, updated_at')->find($digestUserId);

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

           $userModel->update($digestUserId, [
               'settings'   => json_encode($settings),
               'updated_at' => $userData->updated_at,
           ]);

           return $this->respond(lang('Mail.successMessage'));
       }

       // --- Scenario 2: unsubscribe from a specific notification type by sending_mail_id ---
       $mail = $this->request->getGet('mail', FILTER_SANITIZE_SPECIAL_CHARS);

       if (!$mail) {
           return $this->failValidationErrors(lang('Mail.emptyParameters'));
       }

       $sendingEmailModel = new SendingMail();
       $sendingEmailData  = $sendingEmailModel
           ->select('sending_mail.id, activity_id, activity.place_id, activity.type')
           ->join('activity', 'activity.id = sending_mail.activity_id', 'left')
           ->find($mail);

       if (!$sendingEmailData) {
           return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
       }

       if (!$sendingEmailData->activity_id) {
           return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
       }

       $placeModel = new PlacesModel();
       $userModel  = new UsersModel();
       $placeData  = $placeModel->select('user_id')->find($sendingEmailData->place_id);

       if (!$placeData) {
           return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
       }

       $userData   = $userModel->select('settings, updated_at')->find($placeData->user_id);

       if (!$userData) {
           return $this->failValidationErrors(lang('Mail.mailWithIdNotFound'));
       }

       $configItem = $this->_mapActivityType($sendingEmailData->type);

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

       $userModel->update($placeData->user_id, ['settings' => json_encode($settings), 'updated_at' => $userData->updated_at]);

       return $this->respond(lang('Mail.successMessage'));
   }

    /**
     * @param string $activityType
     * @return string
     */
   protected function _mapActivityType(string $activityType): string
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