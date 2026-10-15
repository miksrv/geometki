<?php

namespace App\Libraries;

use Config\Database;

/**
 * "What happened on the site" over a period: event counts by kind and the people
 * behind them, most active first. Shown by the feed (`GET /feed/pulse`, the home
 * page) and the weekly digest email.
 */
class FeedPulseLibrary
{
    /**
     * Counts and people of the period.
     *
     * @param string      $since      Start of the period, 'Y-m-d H:i:s'
     * @param string|null $until      End of the period; null — now
     * @param int         $usersLimit People to return (all are counted in `authors`)
     *
     * @return array{places: int, photos: int, comments: int, ratings: int, edits: int, visits: int,
     *     collections: int, total: int, authors: int,
     *     users: array<int, array{id: string, name: string, avatar: ?string, count: int}>}
     */
    public function build(string $since, ?string $until = null, int $usersLimit = 8): array
    {
        return $this->counts($since, $until) + $this->people($since, $until, $usersLimit);
    }

    /**
     * Events of the period by kind (bookmarks are private and not counted).
     *
     * @return array{places: int, photos: int, comments: int, ratings: int, edits: int, visits: int, collections: int, total: int}
     */
    public function counts(string $since, ?string $until = null): array
    {
        $builder = Database::connect()->table('activity')
            ->select('type, COUNT(*) as cnt')
            ->where('created_at >=', $since)
            ->where('deleted_at', null)
            ->where('type !=', 'bookmark');

        if ($until !== null) {
            $builder->where('created_at <=', $until);
        }

        $counts = array_column($builder->groupBy('type')->get()->getResult(), 'cnt', 'type');

        return [
            'places'      => (int) ($counts['place'] ?? 0),
            'photos'      => (int) ($counts['photo'] ?? 0),
            'comments'    => (int) ($counts['comment'] ?? 0),
            'ratings'     => (int) ($counts['rating'] ?? 0),
            'edits'       => (int) ($counts['edit'] ?? 0) + (int) ($counts['cover'] ?? 0),
            'visits'      => (int) ($counts['visit'] ?? 0),
            'collections' => (int) ($counts['collection'] ?? 0),
            'total'       => (int) array_sum($counts),
        ];
    }

    /**
     * The people who did something in the period, most active first.
     *
     * @return array{authors: int, users: array<int, array{id: string, name: string, avatar: ?string, count: int}>}
     */
    public function people(string $since, ?string $until = null, int $usersLimit = 8): array
    {
        $builder = Database::connect()->table('activity a')
            ->select('u.id, u.name, u.avatar, COUNT(*) as cnt')
            ->join('users u', 'u.id = a.user_id AND u.deleted_at IS NULL')
            ->where('a.created_at >=', $since)
            ->where('a.deleted_at', null)
            ->where('a.type !=', 'bookmark');

        if ($until !== null) {
            $builder->where('a.created_at <=', $until);
        }

        $people  = $builder->groupBy('u.id')->orderBy('cnt', 'DESC')->get()->getResult();
        $avatars = new AvatarLibrary();

        return [
            'authors' => count($people),
            'users'   => array_map(static fn (object $user) => [
                'id'     => $user->id,
                'name'   => $user->name,
                'avatar' => $avatars->buildPath($user->id, $user->avatar, 'small'),
                'count'  => (int) $user->cnt,
            ], array_slice($people, 0, $usersLimit)),
        ];
    }
}
