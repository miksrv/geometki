<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Rules for location slugs (country/region/district/locality) and for the
 * Nominatim reverse-geocoding calls that feed them. See "Слаги локаций" in
 * features/20-location-seo-pages.md for the full spec these implement.
 */
class LocationSlugs extends BaseConfig
{
    /**
     * Service words reserved across the whole slug namespace: client route
     * segments that would otherwise collide with a location slug. Collected
     * from client/pages (top-level and places/-level files) and
     * server/app/Config/Routes.php. category slugs are reserved too, but
     * those come from Config\Categories::$names, not listed here.
     */
    public array $reservedWords = [
        // client/pages top level + places/, search/, collections/, users/, admin/
        'create', 'edit', 'map', 'page', 'search', 'places', 'categories', 'tags',
        'activity', 'auth', 'unsubscribe', 'sitemap', 'admin', 'achievements',
        'users', 'collections', 'settings', 'index', '404', 'en',
    ];

    /**
     * Leading settlement-type words stripped from a locality's slug (kept in
     * the H1). Matched case-insensitively against the start of title_ru,
     * e.g. "село Никольское" → "nikolskoe". Districts keep their own type
     * word ("Советский район" stays "sovetskiy-rayon") — only this list, for
     * localities, is stripped.
     */
    public array $settlementTypeWords = [
        'город', 'село', 'деревня', 'посёлок городского типа', 'посёлок',
        'пгт', 'хутор', 'станица', 'аул', 'местечко', 'слобода', 'починок',
        'выселки', 'урочище', 'кордон', 'разъезд', 'рабочий посёлок',
    ];

    /**
     * Clean-slug priority when several entities at different levels share a
     * normalized name (e.g. country Абхазия vs region Абхазская АР): the
     * lower number wins the unqualified slug, the other is qualified by its
     * parent. Within the same level, the tie-break is the most places (see
     * LocationMerge::pickPrimary()).
     */
    public array $levelPriority = [
        'country'  => 0,
        'region'   => 1,
        'district' => 2,
        'locality' => 3,
    ];

    /** Nominatim `zoom` value that resolves a stable OSM object per level */
    public array $reverseZoomByType = [
        'country'  => 3,
        'region'   => 5,
        'district' => 8,
        'locality' => 10,
    ];

    /** https://operations.osmfoundation.org/policies/nominatim/ — max 1 request/second */
    public float $throttleSeconds = 1.0;

    public string $userAgent = 'Geometki/1.0 (https://geometki.com)';

    /** Retried on 429/5xx with exponential backoff: 2s, 4s, 8s */
    public int $maxRetries = 3;
    public int $retryBaseSeconds = 2;

    /**
     * Minimum place count for a location/category/location×category landing
     * page to be indexable — see "Порог индексации" in
     * features/20-location-seo-pages.md. The single source of truth for the
     * rule: the landing-page API (App\Controllers\Locations,
     * App\Controllers\Categories::locations()) exposes it as the `indexable`
     * flag on every location/category/pair response and the sitemap endpoint
     * (App\Controllers\Sitemap) filters by it, so the client and the sitemap
     * never have to duplicate the number.
     */
    public int $indexThreshold = 5;
}
