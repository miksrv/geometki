<?php

namespace App\Libraries;

use App\Libraries\Mail\MailUrls;
use App\Models\CollectionsModel;
use App\Models\PlacesModel;
use Throwable;

/**
 * Pages of the site to render anew (see Config\SitePages). A write marks the places it
 * changed while it runs; App\Filters\SitePagesFilter sends them once the write succeeded,
 * so a failed write renders nothing. The site renders each path in every locale.
 */
class SitePages
{
    /** @var array<string, true> place ids */
    private static array $places = [];

    /** @var array<string, true> collection ids */
    private static array $collections = [];

    /** @var array<string, true> site paths without the locale prefix */
    private static array $paths = [];

    /** The place's page, by its current slug (read when sent: an edit may change it) */
    public static function place(?string $id): void
    {
        if ($id) {
            self::$places[$id] = true;
        }
    }

    /** The collection's page, by its current slug */
    public static function collection(?string $id): void
    {
        if ($id) {
            self::$collections[$id] = true;
        }
    }

    /** Any page of the site, e.g. a place page under its old slug */
    public static function path(string $path): void
    {
        self::$paths['/' . ltrim($path, '/')] = true;
    }

    public static function reset(): void
    {
        self::$places      = [];
        self::$collections = [];
        self::$paths       = [];
    }

    /** The marked paths, emptied: a request sends them once */
    public static function take(): array
    {
        $paths = self::$paths;

        if (self::$places) {
            $rows = (new PlacesModel())->withDeleted()->select('id, slug')->whereIn('id', array_keys(self::$places))->findAll();

            foreach ($rows as $row) {
                $paths[self::placePath($row->id, $row->slug)] = true;
            }
        }

        if (self::$collections) {
            $rows = (new CollectionsModel())->withDeleted()->select('id, slug')->whereIn('id', array_keys(self::$collections))->findAll();

            foreach ($rows as $row) {
                $paths[self::collectionPath($row->id, $row->slug)] = true;
            }
        }

        self::reset();

        return array_keys($paths);
    }

    /** The same URL as the client's buildPlaceUrl() */
    public static function placePath(string $id, ?string $slug): string
    {
        return '/places/' . $id . ($slug ? '-' . $slug : '');
    }

    /** The same URL as the client's buildCollectionUrl() */
    public static function collectionPath(string $id, ?string $slug): string
    {
        return '/collections/' . $id . ($slug ? '-' . $slug : '');
    }

    /** Asks the site to render the marked pages anew; a failure only leaves them stale until their revalidate time */
    public static function send(): void
    {
        $config = config('SitePages');

        if ($config->secret === '') {
            self::reset();

            return;
        }

        try {
            $paths = self::take();

            if (!$paths) {
                return;
            }

            $url = $config->url !== '' ? $config->url : MailUrls::siteRoot() . '/api/revalidate';

            // A big collection renamed: each page is a render and ~10 API requests, the rest
            // refresh at their daily time
            if (count($paths) > $config->maxPaths) {
                log_message('info', '[SitePages] {count} pages changed, {max} rendered now', [
                    'count' => count($paths),
                    'max'   => $config->maxPaths,
                ]);

                $paths = array_slice($paths, 0, $config->maxPaths);
            }

            // The site takes up to 50 paths a request (client/pages/api/revalidate.ts)
            foreach (array_chunk($paths, 50) as $chunk) {
                $response = service('curlrequest')->post($url, [
                    'headers'         => ['X-Revalidate-Secret' => $config->secret],
                    'json'            => ['paths' => $chunk],
                    'timeout'         => $config->timeout,
                    'connect_timeout' => $config->timeout,
                    'http_errors'     => false,
                ]);

                if ($response->getStatusCode() >= 300) {
                    log_message('warning', '[SitePages] the site answered {status} to {count} paths', [
                        'status' => $response->getStatusCode(),
                        'count'  => count($chunk),
                    ]);
                }
            }
        } catch (Throwable $e) {
            log_message('warning', '[SitePages] pages not revalidated: {message}', ['message' => $e->getMessage()]);
        }
    }
}
