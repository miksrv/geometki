<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The guest cache (App\Filters\GuestCacheFilter): whole JSON answers of public GET requests
 * that come with neither a token nor a session — crawlers rendered by the Next server, and a
 * visitor's very first page. Any write to public data clears it all: the places change rarely,
 * and one place is on its own page, in lists, the feed, collections and the stats.
 *
 * Paths below are matched by their first segments (`users` matches `users/abc/achievements`),
 * a `*` segment matches any one segment, like the place id in the views path below.
 */
class GuestCache extends BaseConfig
{
    public bool $enabled = true;

    /** Seconds an answer is served; a write clears it sooner */
    public int $ttl = DAY;

    /**
     * Answers that change without any write, so a write cannot clear them: seconds they are
     * served instead of $ttl. The longest matching path wins.
     *
     * @var array<string, int>
     */
    public array $ttls = [
        // The users' activity time (the online mark, the default order of the list) is
        // refreshed by their requests; new users sign up through `auth`, a private write
        'users'         => 5 * MINUTE,
        // A rolling window of the last days, and "today" by the server clock
        'feed/pulse'    => 10 * MINUTE,
        'feed/calendar' => 10 * MINUTE,
        // `unexplored` is counted from the OSM candidates a cron job collects every minute
        'stats'         => 10 * MINUTE,
    ];

    public string $path = WRITEPATH . 'cache/guest/';

    /**
     * First path segments whose GET answers are cached. Not here: sign-in, personal lists
     * (bookmarks, notifications), the OSM candidates (a request queues tiles), search
     *
     * @var string[]
     */
    public array $groups = [
        'poi', 'places', 'photos', 'external-photos', 'comments', 'rating', 'feed', 'users',
        'categories', 'location', 'locations', 'collections', 'visited', 'tags', 'stats', 'sitemap',
    ];

    /**
     * Paths whose writes change nothing a guest sees, so they leave the cache: signing in,
     * the user's own point, notifications, push devices, emails, OSM moderation, bookmarks,
     * a photo not yet attached to a place, a place view
     *
     * @var string[]
     */
    public array $privateWrites = [
        'auth', 'location', 'notifications', 'push', 'mail', 'sending-mail', 'osm-candidates', 'bookmarks',
        'photos/upload/temporary', 'photos/rotate/temporary', 'photos/temporary', 'places/*/views',
    ];
}
