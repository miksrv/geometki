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

    protected array $types = ['photo', 'place', 'rating', 'edit', 'cover', 'comment', 'visit', 'bookmark', 'collection', 'collection_place'];

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
     * @param $placeId
     * @throws ReflectionException
     */
    public function visit($placeId): void
    {
        $this->_add('visit', null, $placeId);
    }

    /**
     * @param $placeId
     * @throws ReflectionException
     */
    public function bookmark($placeId): void
    {
        $this->_add('bookmark', null, $placeId);
    }

    /**
     * Record that a collection was created. Fired at most once per
     * collection — the caller (Collections controller) checks
     * ActivityModel::hasCollectionActivity() first.
     *
     * @param string $collectionId
     * @param string|null $asUserId Attribute the activity (and its XP/achievements)
     *                              to this user instead of the current session —
     *                              used when an admin or another member added the
     *                              places, so credit still goes to the collection's
     *                              actual owner.
     * @throws ReflectionException
     */
    public function collection(string $collectionId, ?string $asUserId = null): void
    {
        $this->_add('collection', null, null, null, null, $collectionId, $asUserId);
    }

    /**
     * Record that a place was added to someone else's collection, and
     * (via ->owner()) notify the place's owner.
     *
     * @param string $collectionId
     * @param string $placeId
     * @throws ReflectionException
     */
    public function collectionPlace(string $collectionId, string $placeId): void
    {
        $this->_add('collection_place', null, $placeId, null, null, $collectionId);
    }

    /**
     * @param string $type One of: 'photo', 'place', 'rating', 'edit', 'cover', 'comment', 'visit', 'bookmark', 'collection', 'collection_place'
     * @param string|null $photoId
     * @param string|null $placeId
     * @param string|null $ratingId
     * @param string|null $commentId
     * @param string|null $collectionId
     * @param string|null $asUserId Attribute the activity (and its XP/achievements)
     *                              to this user instead of the current session's user.
     * @throws ReflectionException
     * @throws Exception
     */
    protected function _add(
        string $type,
        string|null $photoId  = null,
        string|null $placeId  = null,
        string|null $ratingId = null,
        string|null $commentId = null,
        string|null $collectionId = null,
        string|null $asUserId = null,
    ): void {
        if (!in_array($type, $this->types)) {
            return ;
        }

        $timeNow = new Time('now');
        $model   = new ActivityModel();
        $session = new SessionLibrary();

        // Normally the activity is attributed to whoever is acting in the
        // current session. When $asUserId is given, attribute it (and the
        // XP/achievements below) to that user instead.
        $attributedUserId = $asUserId ?? ($session->user?->id ?? null);
        $isAttributedAuth = $asUserId !== null || $session->isAuth;

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
        $activity->session_id = !$isAttributedAuth ? $session->id : null;
        $activity->user_id    = $attributedUserId;
        $activity->photo_id   = $photoId;
        $activity->place_id   = $placeId;
        $activity->rating_id  = $ratingId;
        $activity->comment_id = $commentId;
        $activity->collection_id = $collectionId;

        $model->insert($activity);
        $session->update();

        $activityId = $model->getLastGeneratedId();

        // If user authorized - add user experience
        if ($isAttributedAuth && $attributedUserId) {
            $levels = new LevelsLibrary();
            $levels->push($type, $attributedUserId, $activityId);

            $achievements = new AchievementsLibrary();
            $achievements->check($attributedUserId, $type);
        }

        // Send notification to place owner
        if (isset($this->owner) && $this->owner !== $attributedUserId) {
            $notify = new NotifyLibrary();
            $notify->push($type, $this->owner, $activityId);

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
                || ($settings->emailBookmark && $type === 'bookmark')
                || ($settings->emailVisit && $type === 'visit')
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
                $email->activity_id = $activityId;
                $email->email       = $ownerUser->email;
                $email->locale      = $ownerUser->locale;

                $sendingEmailModel->insert($email);
            }
        }
    }
}
