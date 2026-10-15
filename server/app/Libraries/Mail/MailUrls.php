<?php

namespace App\Libraries\Mail;

/**
 * Absolute links used in emails. The site lives at `app.siteUrl` (English
 * under `/en`), the API at `app.baseURL`, images at `mail.imageHost`
 * (defaults to the API, which serves `uploads/`).
 */
class MailUrls
{
    private const DEFAULT_SITE = 'https://geometki.com';
    private const DEFAULT_API  = 'https://api.geometki.com';

    private static bool $warned    = false;
    private static bool $apiWarned = false;

    public static function siteRoot(): string
    {
        $site = self::setting('app.siteUrl');

        // A local or staging setup without it would mail links to production (said once per run)
        if (!$site && ENVIRONMENT !== 'production' && !self::$warned) {
            self::$warned = true;
            log_message('warning', '[Mail] app.siteUrl is not set: email links point to ' . self::DEFAULT_SITE);
        }

        return rtrim((string) ($site ?: self::DEFAULT_SITE), '/');
    }

    /**
     * A setting from the process environment first, then `.env`: CodeIgniter's env()
     * prefers `.env`, so `app.siteUrl=… php spark system:test-email` would be ignored.
     */
    private static function setting(string $name): ?string
    {
        $value = getenv($name);

        return $value !== false && $value !== '' ? $value : (env($name) ?: null);
    }

    /**
     * A page of the site in the given locale: site('en', '/places') → https://geometki.com/en/places
     */
    public static function site(string $locale, string $path = '/'): string
    {
        $path = '/' . ltrim($path, '/');

        return self::siteRoot() . ($locale === 'en' ? '/en' : '') . ($path === '/' ? '' : $path);
    }

    public static function place(string $locale, string $placeId, ?string $slug = null): string
    {
        return self::site($locale, '/places/' . ($slug ? $placeId . '-' . $slug : $placeId));
    }

    public static function settings(string $locale): string
    {
        return self::site($locale, '/users/settings');
    }

    public static function unsubscribePage(string $locale, string $token): string
    {
        return self::site($locale, '/unsubscribe?token=' . rawurlencode($token));
    }

    /**
     * The RFC 8058 one-click endpoint for the List-Unsubscribe header (the API, POST).
     */
    public static function oneClickUnsubscribe(string $token): string
    {
        return self::apiRoot() . '/mail/unsubscribe?token=' . rawurlencode($token);
    }

    /**
     * The 680px preview of a place cover: plenty for an email, a fraction of the full size.
     */
    public static function placeCover(string $placeId): string
    {
        return self::upload(PATH_PHOTOS . $placeId . '/cover_preview.jpg');
    }

    /**
     * A file the API serves, by the relative path the API returns (`uploads/…`);
     * an absolute URL is kept.
     */
    public static function upload(string $path): string
    {
        if (preg_match('#^https?://#i', $path)) {
            return $path;
        }

        return self::imageRoot() . '/' . ltrim($path, '/');
    }

    public static function collection(string $locale, string $collectionId, ?string $slug = null): string
    {
        return self::site($locale, '/collections/' . ($slug ? $collectionId . '-' . $slug : $collectionId));
    }

    public static function user(string $locale, string $userId, string $tab = ''): string
    {
        return self::site($locale, '/users/' . $userId . ($tab !== '' ? '/' . $tab : ''));
    }

    public static function noAvatar(): string
    {
        return self::siteRoot() . '/images/no-avatar.png';
    }

    public static function logo(): string
    {
        return self::siteRoot() . '/images/geometki-icon.png';
    }

    public static function apiRoot(): string
    {
        // Not config('App')->baseURL: without the setting it is the framework's
        // localhost default, and emails would load covers from http://localhost:8080
        $api = self::setting('app.baseURL');

        if (!$api && ENVIRONMENT !== 'production' && !self::$apiWarned) {
            self::$apiWarned = true;
            log_message('warning', '[Mail] app.baseURL is not set: email images and unsubscribe links point to ' . self::DEFAULT_API);
        }

        return rtrim((string) ($api ?: self::DEFAULT_API), '/');
    }

    public static function imageRoot(): string
    {
        return rtrim((string) (self::setting('mail.imageHost') ?: self::apiRoot()), '/');
    }
}
