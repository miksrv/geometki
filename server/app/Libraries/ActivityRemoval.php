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
 * - their cached achievement progress (AchievementsLibrary::forgetProgress()).
 */
class ActivityRemoval
{
    /**
     * @param string[] $userIds  Those whose activity goes
     * @param string[] $placeIds The places it was about
     * @param string[] $feedIds  The stories it was in
     */
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

    /** A user's activity of one type about a place: a visit or a bookmark taken back */
    public static function forUserPlace(string $userId, string $placeId, string $type): self
    {
        return self::collect('user_id = ? AND place_id = ? AND type = ?', [$userId, $placeId, $type]);
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

        try {
            $levels     = new LevelsLibrary();
            $usersModel = new UsersModel();

            foreach ($this->userIds as $userId) {
                $user = $usersModel->select('id, experience, level')->find($userId);

                if ($user) {
                    $levels->calculate($user, false);
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
