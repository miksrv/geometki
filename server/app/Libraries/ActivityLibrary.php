<?php

namespace App\Libraries;

use App\Libraries\AchievementsLibrary;
use App\Models\ActivityModel;
use App\Models\SendingMail;
use App\Models\UsersModel;
use CodeIgniter\I18n\Time;
use Exception;
use ReflectionException;

const ACTIVITY_FLOOD_MIN = 35;
const EMAIL_NOTIFY_FLOOD_HOURS = 5;

class ActivityLibrary {
    private string $owner;

    protected array $types = ['photo', 'place', 'rating', 'edit', 'cover', 'comment'];

    public function owner(string $userId): static
    {
        $this->owner = $userId;

        return $this;
    }

    /**
     * @param $photoId
     * @param $placeId
     * @throws ReflectionException
     */
    public function photo($photoId, $placeId): void
    {
        $this->_add('photo', $photoId, $placeId);
    }

    /**
     * @param $placeId
     * @throws ReflectionException
     */
    public function place($placeId): void
    {
        $this->_add('place', null, $placeId);
    }

    /**
     * @throws ReflectionException
     */
    public function edit($placeId): void
    {
        $this->_add('edit', null, $placeId);
    }

    /**
     * @throws ReflectionException
     */
    public function cover($placeId): void
    {
        $this->_add('cover', null, $placeId);
    }

    /**
     * @param $placeId
     * @param $ratingId
     * @throws ReflectionException
     */
    public function rating($placeId, $ratingId): void
    {
        $this->_add('rating', null, $placeId, $ratingId);
    }

    /**
     * @param $placeId
     * @param $commentId
     * @throws ReflectionException
     */
    public function comment($placeId, $commentId): void
    {
        $this->_add('comment', null, $placeId, null, $commentId);
    }

    /**
     * @param string $type One of: 'photo', 'place', 'rating', 'edit', 'cover', 'comment'
     * @param string|null $photoId
     * @param string|null $placeId
     * @param string|null $ratingId
     * @param string|null $commentId
     * @throws ReflectionException
     * @throws Exception
     */
    protected function _add(
        string $type,
        string|null $photoId  = null,
        string|null $placeId  = null,
        string|null $ratingId = null,
        string|null $commentId = null,
    ): void {
        if (!in_array($type, $this->types)) {
            return ;
        }

        $timeNow = new Time('now');
        $model   = new ActivityModel();
        $session = new SessionLibrary();

        /**
         * If no more than that many minutes have passed since the user’s previous activity with exactly
         * the same parameters (for example, editing a specific place),
         * then new activity and experience will not be added
         *
         * !!! ONLY FOR 'photo' $type !!!
         */
        if ($type === 'photo') {
            $lastData = $model
                ->where([
                    'type'       => $type,
                    'session_id' => !$session->isAuth ? $session->id : null,
                    'user_id'    => $session->user?->id ?? null,
                    'place_id'   => $placeId,
                    'photo_id'   => $photoId,
                    'rating_id'  => $ratingId
                ])
                ->orderBy('created_at', 'DESC')
                ->first();

            if ($lastData && abs($timeNow->difference($lastData->created_at)->getMinutes()) <= ACTIVITY_FLOOD_MIN) {
                return ;
            }
        }

        $activity = new \App\Entities\ActivityEntity();

        $activity->type       = $type;
        $activity->session_id = !$session->isAuth ? $session->id : null;
        $activity->user_id    = $session->user?->id ?? null;
        $activity->photo_id   = $photoId;
        $activity->place_id   = $placeId;
        $activity->rating_id  = $ratingId;
        $activity->comment_id = $commentId;

        $model->insert($activity);
        $session->update();

        // If user authorized - add user experience
        if ($session->isAuth && $session->user?->id) {
            $levels = new LevelsLibrary();
            $levels->push($type, $session->user?->id, $model->getInsertID());

            $achievements = new AchievementsLibrary();
            $achievements->check($session->user->id, $type);
        }

        // Send notification to place owner
        if (isset($this->owner) && $this->owner !== $session->user?->id) {
            $notify = new NotifyLibrary();
            $notify->push($type, $this->owner, $model->getInsertID());

            // Get owner email settings
            $userModel = new UsersModel();
            $ownerUser = $userModel->getUserById($this->owner, true);
            $settings  = $ownerUser->settings;

            /**
             * Email Notifications
             */
            if (($settings->emailPhoto && $type === 'photo')
                || ($settings->emailComment && $type === 'comment')
                || ($settings->emailEdit && $type === 'edit')
                || ($settings->emailRating && $type === 'rating')
                || ($settings->emailCover && $type === 'cover')
            ) {
                /**
                 * When we send email as notification of any activity on the site, we
                 * do not fill in subject and message, they are filled in themselves if activity_id is set
                 */
                $sendingEmailModel = new SendingMail();
                $lastSendEmailTime = $sendingEmailModel->checkSendLastEmail($ownerUser->email);

                if ($lastSendEmailTime && abs($timeNow->difference($lastSendEmailTime->created_at)->getHours()) <= EMAIL_NOTIFY_FLOOD_HOURS) {
                    return ;
                }

                $email = new \App\Entities\SendingMailEntity();
                $email->activity_id = $model->getInsertID();
                $email->email       = $ownerUser->email;
                $email->locale      = $ownerUser->locale;

                $sendingEmailModel->insert($email);
            }
        }
    }
}
