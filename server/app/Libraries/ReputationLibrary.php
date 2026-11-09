<?php

namespace App\Libraries;

use Config\Database;

/**
 * A user's reputation: their share of the scores of the places they made. A vote is worth
 * 1★ −2, 2★ −1, 3★ 0, 4★ +1, 5★ +2 (rating_helper transformRating()). Half of it goes to the
 * place's author, for finding the place; the other half to those who had made the card by
 * the time of the vote, by the weight of what they did (CONTRIBUTIONS, as in the experience).
 * The author's own photos and edits count there too, so an author who made the card alone
 * gets the whole vote, as they do when nobody contributed.
 *
 * Always rebuilt from the votes, never moved by a delta: a changed vote, a deleted place or
 * photo, or two votes at once then cannot leave it off. Guests' votes count; the author's
 * own votes (left from before Rating.ownPlace) do not, and a contributor gets no share of
 * their own vote. Bots' and deleted users' contributions earn nothing. Kept as an integer: the shares are
 * summed per user, then rounded.
 */
class ReputationLibrary
{
    /** The author's share of a vote when others contributed to the card */
    public const AUTHOR_SHARE = 0.5;

    /** The weight of a contribution to the card, as its experience */
    public const CONTRIBUTIONS = [
        'photo'      => MODIFIER_PHOTO,
        'edit'       => MODIFIER_EDIT,
        'cover'      => MODIFIER_COVER,
        'photo_link' => MODIFIER_PHOTO_LINK,
    ];

    /** The cached history of a user (history()): dropped by every recount of the user */
    private const HISTORY_CACHE_PREFIX = 'reputation_history_';

    /** The points of a vote by its stars, the same as transformRating() */
    public const POINTS = [1 => -2, 2 => -1, 3 => 0, 4 => 1, 5 => 2];

    /**
     * The shares of one place's votes.
     *
     * @param string|null $authorId      The place's author
     * @param object[]    $votes         {user_id: ?string, value: int, created_at: int}
     * @param object[]    $contributions {user_id: string, type: string, created_at: int}
     * @return array<string, float> Points by user
     */
    public static function placePoints(?string $authorId, array $votes, array $contributions): array
    {
        $points = [];

        foreach ($votes as $vote) {
            foreach (self::voteShares($authorId, $vote, $contributions) as $userId => $share) {
                $points[$userId] = ($points[$userId] ?? 0) + $share;
            }
        }

        return $points;
    }

    /**
     * The shares of one vote on a place, by user: the author's half and the contributors' half
     * by the weight of what they had done by then; none for a 3★ vote.
     *
     * @param string|null $authorId      The place's author
     * @param object      $vote          {user_id: ?string, value: int, created_at: int}
     * @param object[]    $contributions {user_id: string, type: string, created_at: int}
     *
     * @return array<string, float> Points by user
     */
    public static function voteShares(?string $authorId, object $vote, array $contributions): array
    {
        $value = self::POINTS[(int) $vote->value] ?? 0;

        if ($value === 0) {
            return [];
        }

        // What the card was when the vote was given, without the voter's own part
        $weights = [];

        foreach ($contributions as $contribution) {
            if ($contribution->created_at > $vote->created_at
                || ($vote->user_id !== null && $contribution->user_id === $vote->user_id)) {
                continue;
            }

            $weights[$contribution->user_id] = ($weights[$contribution->user_id] ?? 0)
                + (self::CONTRIBUTIONS[$contribution->type] ?? 0);
        }

        $total = array_sum($weights);

        if ($total <= 0) {
            return $authorId ? [$authorId => $value] : [];
        }

        $shares = [];
        $pool   = $value;

        if ($authorId) {
            $shares[$authorId] = $value * self::AUTHOR_SHARE;
            $pool              = $value * (1 - self::AUTHOR_SHARE);
        }

        foreach ($weights as $userId => $weight) {
            $shares[$userId] = ($shares[$userId] ?? 0) + $pool * $weight / $total;
        }

        return $shares;
    }

    /**
     * Those whose reputation a vote on the place moves: its author and its contributors.
     *
     * @return string[]
     */
    public function usersOfPlace(string $placeId): array
    {
        $db   = Database::connect();
        $rows = $db->query(
            'SELECT user_id FROM places WHERE id = ? AND user_id IS NOT NULL
             UNION
             SELECT user_id FROM activity
             WHERE place_id = ? AND user_id IS NOT NULL AND deleted_at IS NULL AND type IN ?',
            [$placeId, $placeId, array_keys(self::CONTRIBUTIONS)]
        )->getResult();

        return array_column($rows, 'user_id');
    }

    /** Recalculate one user's reputation, save it and return it */
    public function recalculate(string $userId): int
    {
        return $this->recalculateUsers([$userId])[$userId] ?? 0;
    }

    /**
     * Recalculate these users' reputation from every place they made and save what changed.
     * `updated_at` is kept: a score on a place is not an edit of its author's profile.
     *
     * @param string[] $userIds
     * @return array<string, int> The reputation by user
     */
    public function recalculateUsers(array $userIds): array
    {
        $userIds = array_values(array_unique(array_filter($userIds)));

        if (!$userIds) {
            return [];
        }

        $places = $this->scoredPlacesOf($userIds);
        $points = $places ? $this->points($places) : [];
        $result = [];

        foreach ($userIds as $userId) {
            $result[$userId] = (int) round($points[$userId] ?? 0);
            // A vote or a removal moved their shares: the history is read anew
            cache()->delete(self::HISTORY_CACHE_PREFIX . $userId);
        }

        $this->save($result);

        return $result;
    }

    /**
     * Recalculate everyone's reputation (`php spark reputation:rebuild`).
     *
     * @return int How many users' reputation changed
     */
    public function recalculateAll(): int
    {
        $points = $this->points(null);
        $users  = Database::connect()->table('users')->select('id')->get()->getResult();
        $result = [];

        foreach ($users as $user) {
            $result[$user->id] = (int) round($points[$user->id] ?? 0);
        }

        cache()->deleteMatching(self::HISTORY_CACHE_PREFIX . '*');

        return $this->save($result);
    }

    /**
     * Authors' votes for their own places, left from before Rating.ownPlace refused them:
     * the vote, its place, its author and the feed story of its activity.
     *
     * @return object[]
     */
    public function findOwnVotes(): array
    {
        return Database::connect()->query(
            'SELECT r.id, r.place_id, r.user_id, a.id AS activity_id, a.feed_id
             FROM rating r
             JOIN places p ON p.id = r.place_id
             LEFT JOIN activity a ON a.rating_id = r.id
             WHERE r.user_id = p.user_id'
        )->getResult();
    }

    /**
     * Delete the authors' votes for their own places and their activity (its notifications and
     * queued emails go with it by the foreign keys), then recount the scores of those places.
     * The caller then refreshes the feed, the authors' experience and the reputation (ActivityRemoval).
     *
     * @param object[] $votes findOwnVotes()
     * @return string[] The ids of the places whose score was recounted
     */
    public function deleteOwnVotes(array $votes): array
    {
        if (!$votes) {
            return [];
        }

        $db        = Database::connect();
        $ratingIds = array_values(array_unique(array_column($votes, 'id')));
        $placeIds  = array_values(array_unique(array_column($votes, 'place_id')));

        $db->transException(true)->transStart();

        $db->table('activity')->whereIn('rating_id', $ratingIds)->delete();
        $db->table('rating')->whereIn('id', $ratingIds)->delete();

        // The place's average of the votes left, as Rating::set() keeps it; updated_at kept:
        // a recount is not an edit of the place
        $db->query(
            'UPDATE places p
             LEFT JOIN (
                 SELECT place_id, ROUND(AVG(value), 1) AS rating
                 FROM rating
                 WHERE deleted_at IS NULL AND place_id IN ?
                 GROUP BY place_id
             ) t ON t.place_id = p.id
             SET p.rating = t.rating, p.updated_at = p.updated_at
             WHERE p.id IN ?',
            [$placeIds, $placeIds]
        );

        $db->transComplete();
        $db->transException(false);

        return $placeIds;
    }

    /**
     * The points of the votes on these places (all places when null), by user.
     *
     * @param string[]|null $placeIds
     * @return array<string, float>
     */
    private function points(?array $placeIds): array
    {
        [$authors, $votesByPlace, $contributionsByPlace] = $this->load($placeIds);

        $points = [];

        foreach ($authors as $place) {
            if (empty($votesByPlace[$place->id])) {
                continue;
            }

            $shares = self::placePoints($place->user_id, $votesByPlace[$place->id], $contributionsByPlace[$place->id] ?? []);

            foreach ($shares as $userId => $share) {
                $points[$userId] = ($points[$userId] ?? 0) + $share;
            }
        }

        return $points;
    }

    /**
     * The history of a user's reputation: every vote that moved it, the newest first, with the
     * user's share of it and why they got one (`author` of the place or a `contributor` to its
     * card). The shares add up to the reputation (before its rounding). Who voted is not told.
     *
     * @return array<int, array{id: string, placeId: string, stars: int, points: float, role: string, created: int}>
     */
    public function history(string $userId): array
    {
        // Every page of the history reads it whole: computed once, until a recount of this user
        $cacheKey = self::HISTORY_CACHE_PREFIX . $userId;
        $cached   = cache($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        $items = $this->computeHistory($userId);

        cache()->save($cacheKey, $items, DAY);

        return $items;
    }

    /**
     * @return array<int, array{id: string, placeId: string, stars: int, points: float, role: string, created: int}>
     */
    private function computeHistory(string $userId): array
    {
        $places = $this->scoredPlacesOf([$userId]);

        if (!$places) {
            return [];
        }

        [$authors, $votesByPlace, $contributionsByPlace] = $this->load($places);

        $items = [];

        foreach ($authors as $place) {
            foreach ($votesByPlace[$place->id] ?? [] as $vote) {
                $share = self::voteShares($place->user_id, $vote, $contributionsByPlace[$place->id] ?? [])[$userId] ?? 0;

                if (abs($share) < 1e-9) {
                    continue;
                }

                $items[] = [
                    'id'      => $vote->id,
                    'placeId' => $place->id,
                    'stars'   => (int) $vote->value,
                    'points'  => round($share, 2),
                    'role'    => $place->user_id === $userId ? 'author' : 'contributor',
                    'created' => $vote->created_at,
                ];
            }
        }

        usort($items, static fn (array $a, array $b) => [$b['created'], $b['id']] <=> [$a['created'], $a['id']]);

        return $items;
    }

    /**
     * The places these users added or contributed to that have votes: a vote on a place moves
     * the reputation on every score, and a busy editor has touched many places nobody scored.
     *
     * @param string[] $userIds
     *
     * @return string[]
     */
    private function scoredPlacesOf(array $userIds): array
    {
        $rows = Database::connect()->query(
            'SELECT t.id FROM (
                 SELECT id FROM places WHERE user_id IN ? AND deleted_at IS NULL
                 UNION
                 SELECT place_id FROM activity
                 WHERE user_id IN ? AND deleted_at IS NULL AND type IN ?
             ) t
             WHERE EXISTS (SELECT 1 FROM rating r WHERE r.place_id = t.id AND r.deleted_at IS NULL)',
            [$userIds, $userIds, array_keys(self::CONTRIBUTIONS)]
        )->getResult();

        return array_column($rows, 'id');
    }

    /**
     * The places (all when null) with their authors, their votes and the contributions to them.
     *
     * @param string[]|null $placeIds
     *
     * @return array{0: object[], 1: array<string, object[]>, 2: array<string, object[]>}
     */
    private function load(?array $placeIds): array
    {
        $db       = Database::connect();
        $inPlaces = $placeIds === null ? '' : ' AND p.id IN ?';
        $binds    = $placeIds === null ? [] : [$placeIds];

        $authors = $db->query(
            'SELECT p.id, p.user_id FROM places p WHERE p.deleted_at IS NULL' . $inPlaces,
            $binds
        )->getResult();

        $votes = $db->query(
            'SELECT r.id, r.place_id, r.user_id, r.value, r.created_at
             FROM rating r
             JOIN places p ON p.id = r.place_id AND p.deleted_at IS NULL
             WHERE r.deleted_at IS NULL
               AND (r.user_id IS NULL OR p.user_id IS NULL OR r.user_id <> p.user_id)' . $inPlaces,
            $binds
        )->getResult();

        $contributions = $db->query(
            "SELECT a.place_id, a.user_id, a.type, a.created_at
             FROM activity a
             JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL
             JOIN users u ON u.id = a.user_id AND u.role <> 'bot' AND u.deleted_at IS NULL
             WHERE a.deleted_at IS NULL AND a.type IN ?" . $inPlaces,
            array_merge([array_keys(self::CONTRIBUTIONS)], $binds)
        )->getResult();

        $votesByPlace = [];

        foreach ($votes as $vote) {
            $vote->created_at                = strtotime($vote->created_at);
            $votesByPlace[$vote->place_id][] = $vote;
        }

        $contributionsByPlace = [];

        foreach ($contributions as $contribution) {
            $contribution->created_at                        = strtotime($contribution->created_at);
            $contributionsByPlace[$contribution->place_id][] = $contribution;
        }

        return [$authors, $votesByPlace, $contributionsByPlace];
    }

    /**
     * Save the users' reputation where it differs.
     *
     * @param array<string, int> $reputation By user
     * @return int How many changed
     */
    private function save(array $reputation): int
    {
        if (!$reputation) {
            return 0;
        }

        $db      = Database::connect();
        $current = $db->table('users')->select('id, reputation')->whereIn('id', array_keys($reputation))->get()->getResult();
        $changed = 0;

        foreach ($current as $user) {
            $value = $reputation[$user->id];

            if ((int) $user->reputation !== $value) {
                $db->table('users')->where('id', $user->id)->update(['reputation' => $value]);
                // A vote by someone else moves it: the user's own action did not drop the progress
                AchievementsLibrary::forgetProgress($user->id);
                $changed++;
            }
        }

        return $changed;
    }
}
