<?php

namespace App\Libraries;

use App\Libraries\AchievementsLibrary;
use App\Libraries\Mail\MailQueue;
use App\Models\ActivityModel;
use App\Models\UsersModel;
use CodeIgniter\I18n\Time;
use Exception;
use ReflectionException;
use Throwable;

const ACTIVITY_FLOOD_MIN = 35;

class ActivityLibrary {
    private string $owner;

    protected array $types = ['photo', 'place', 'rating', 'edit', 'cover', 'comment', 'visit', 'bookmark', 'collection', 'collection_place', 'photo_link'];

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
     * A PastVu or Wikimedia Commons photo linked to a place. Unlinking deletes the photo
     * row and, by the foreign key, this activity row with it.
     *
     * @param string $externalPhotoId places_external_photos.id
     * @param string $placeId
     * @throws ReflectionException
     */
    public function photoLink(string $externalPhotoId, string $placeId): void
    {
        $this->_add('photo_link', null, $placeId, externalPhotoId: $externalPhotoId);
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
    /**
     * A check-in: one event per visit (users_visited_places.id), so deleting the visit removes it alone
     */
    public function visit(string $placeId, string $visitId): void
    {
        $this->_add('visit', null, $placeId, visitId: $visitId);
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
     * @param string $type One of: 'photo', 'place', 'rating', 'edit', 'cover', 'comment', 'visit', 'bookmark', 'collection', 'collection_place', 'photo_link'
     * @param string|null $photoId
     * @param string|null $placeId
     * @param string|null $ratingId
     * @param string|null $commentId
     * @param string|null $collectionId
     * @param string|null $asUserId Attribute the activity (and its XP/achievements)
     *                              to this user instead of the current session's user.
     * @param string|null $externalPhotoId A linked PastVu / Commons photo (places_external_photos.id)
     * @param string|null $visitId The visit of a 'visit' event (users_visited_places.id)
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
        string|null $externalPhotoId = null,
        string|null $visitId = null,
    ): void {
        // Whatever happened on a place shows on its page, but a bookmark: the page shows no
        // count of them, and the write leaves the guest cache, so a render would read it stale
        if ($type !== 'bookmark') {
            SitePages::place($placeId);
        }

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
        $activity->external_photo_id = $externalPhotoId;
        $activity->place_id   = $placeId;
        $activity->rating_id  = $ratingId;
        $activity->comment_id = $commentId;
        $activity->collection_id = $collectionId;
        $activity->visit_id   = $visitId;

        $model->insert($activity);
        $session->update();

        $activityId = $model->getLastGeneratedId();

        // The feed is a view of the log: a failure there must not fail the action itself
        try {
            (new FeedLibrary())->attach($activityId, $type, $attributedUserId, $placeId, $collectionId, $timeNow->getTimestamp());
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }

        // If user authorized - add user experience
        if ($isAttributedAuth && $attributedUserId) {
            $levels = new LevelsLibrary();
            $levels->push($type, $attributedUserId, $activityId);

            $achievements = new AchievementsLibrary();
            $achievements->check($attributedUserId, $type);
        }

        // Send notification to place owner
        if (isset($this->owner) && $this->owner !== $attributedUserId) {
            // Like the feed, the in-app notification must not fail the action itself
            try {
                (new NotifyLibrary())->push($type, $this->owner, $activityId);
            } catch (Throwable $e) {
                log_message('error', '{exception}', ['exception' => $e]);
            }

            // Email: queued if the owner wants it; MailQueue groups and paces what follows
            try {
                $owner = (new UsersModel())
                    ->select('id, email, email_bounced_at, locale, settings')
                    ->find($this->owner);

                if ($owner) {
                    (new MailQueue())->queueActivity($owner, $type, $activityId);
                }
            } catch (Throwable $e) {
                log_message('error', '{exception}', ['exception' => $e]);
            }
        }
    }
}
