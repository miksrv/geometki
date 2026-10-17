<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The guest cache (App\Filters\GuestCacheFilter): whole JSON answers of public GET requests
 * that come with neither a token nor a session — crawlers rendered by the Next server, and a
 * visitor's very first page. Any write to public data clears it all: the places change rarely,
 * and one place is on its own page, in lists, the feed, collections and the stats.
 */
class GuestCache extends BaseConfig
{
    public bool $enabled = true;

    /** Seconds an answer is served; a write clears it sooner */
    public int $ttl = DAY;

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
     * First path segments whose writes change nothing a guest sees, so they leave the cache:
     * signing in, the user's own point, notifications, push devices, emails, OSM moderation
     *
     * @var string[]
     */
    public array $privateWrites = ['auth', 'location', 'notifications', 'push', 'mail', 'sending-mail', 'osm-candidates'];
}
