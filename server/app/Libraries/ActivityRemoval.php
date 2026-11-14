<?php

namespace App\Libraries;

use App\Models\UsersModel;
use Config\Database;
use Throwable;

/**
 * What follows a removal of activity: the experience, the reputation and the feed are kept
 * by the actions (a view of a profile or a feed recounts nothing), so a removal brings them
 * in line itself.
 *
 * Collected before the delete, while the activity is still there; applied after it:
 *
 *     $removal = ActivityRemoval::forPlace($id);
 *     $this->model->delete($id, true);
 *     $removal->apply();
 *
 * - the experience of everyone whose activity went (LevelsLibrary::calculate(), silent);
 * - the reputation of the author and the contributors of the places concerned
 *   (ReputationLibrary: votes and contributions both move it);
 * - the stories the activity was in (FeedLibrary::refresh());
 * - their cached achievement progress (AchievementsLibrary::forgetProgress());
 * - when the one who removes it is told (`by()`) and the activity is their own: the awards it
 *   had earned them (AchievementsLibrary::reconcile()) — a visit cancelled, a photo deleted
 *   takes back the award it brought, with its story and its experience, and a level story
 *   above the level they are left with. Someone else's removal (an administrator deleting a
 *   place) takes no award from anyone.
 */
class ActivityRemoval
{
    /**
     * @param string[] $userIds  Those whose activity goes
     * @param string[] $placeIds The places it was about
     * @param string[] $feedIds  The stories it was in
     */
    /** The one who removes the activity: their own awards are brought in line with what is left */
    private ?string $actorId = null;

    private function __construct(
        private array $userIds,
        private array $placeIds,
        private array $feedIds
    ) {
    }

    /** All the activity about a place: the place is deleted */
    public static function forPlace(string $placeId): self
    {
        return self::collect('place_id = ?', [$placeId]);
    }

    /** The activity of an uploaded photo: the photo is deleted */
    public static function forPhoto(string $photoId): self
    {
        return self::collect('photo_id = ?', [$photoId]);
    }

    /** The activity of a linked photo: the link is removed */
    public static function forExternalPhoto(string $externalPhotoId): self
    {
        return self::collect('external_photo_id = ?', [$externalPhotoId]);
    }

    /**
     * The activity of these votes
     *
     * @param string[] $ratingIds
     */
    public static function forRatings(array $ratingIds): self
    {
        return $ratingIds ? self::collect('rating_id IN ?', [$ratingIds]) : new self([], [], []);
    }

    /** The event of one visit: the visit is deleted */
    public static function forVisit(string $visitId): self
    {
        return self::collect('visit_id = ?', [$visitId]);
    }

    /** A user's activity of one type about a place: a bookmark taken back */
    public static function forUserPlace(string $userId, string $placeId, string $type): self
    {
        return self::collect('user_id = ? AND place_id = ? AND type = ?', [$userId, $placeId, $type]);
    }

    /** Who removes the activity: when it is their own, the awards it earned them go with it */
    public function by(?string $userId): self
    {
        $this->actorId = $userId;

        return $this;
    }

    private static function collect(string $where, array $binds): self
    {
        $rows = Database::connect()->query(
            "SELECT user_id, place_id, feed_id FROM activity WHERE deleted_at IS NULL AND $where",
            $binds
        )->getResult();

        $placeIds   = array_values(array_unique(array_filter(array_column($rows, 'place_id'))));
        $reputation = new ReputationLibrary();
        $userIds    = array_column($rows, 'user_id');

        // The author and the contributors of each place: their shares change with it
        foreach ($placeIds as $placeId) {
            $userIds = array_merge($userIds, $reputation->usersOfPlace($placeId));
        }

        return new self(
            array_values(array_unique(array_filter($userIds))),
            $placeIds,
            array_values(array_unique(array_filter(array_column($rows, 'feed_id'))))
        );
    }

    /** Bring the experience, the reputation and the feed in line, once the activity is gone */
    public function apply(): void
    {
        // The removal itself has succeeded: a failure here must not fail it
        try {
            (new FeedLibrary())->refresh($this->feedIds);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }

        // Before the experience is recounted: it sums the awards held
        if ($this->actorId && in_array($this->actorId, $this->userIds, true)) {
            try {
                (new AchievementsLibrary())->reconcile($this->actorId);
            } catch (Throwable $e) {
                log_message('error', '{exception}', ['exception' => $e]);
            }
        }

        try {
            $levels     = new LevelsLibrary();
            $usersModel = new UsersModel();

            foreach ($this->userIds as $userId) {
                $user = $usersModel->select('id, experience, level')->find($userId);

                if ($user) {
                    $levels->calculate($user, false);
                }
            }

            // A "new level" story above the level the actor is left with is no longer true
            if ($this->actorId && in_array($this->actorId, $this->userIds, true)) {
                $actor = $usersModel->select('id, level')->find($this->actorId);

                if ($actor) {
                    Database::connect()->table('feed')
                        ->where(['user_id' => $actor->id, 'type' => 'level'])
                        ->where('level >', (int) $actor->level)
                        ->delete();
                }
            }

            (new ReputationLibrary())->recalculateUsers($this->userIds);

            // Their counts of places, photos, visits... have changed
            foreach ($this->userIds as $userId) {
                AchievementsLibrary::forgetProgress($userId);
            }
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }
    }

    /** @return string[] The places the removed activity was about */
    public function placeIds(): array
    {
        return $this->placeIds;
    }
}
