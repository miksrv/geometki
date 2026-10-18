<?php

namespace App\Filters;

use App\Libraries\GuestCache;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\GuestCache as GuestCacheConfig;

/**
 * Serves public GET answers of guests from the cache and clears it after a write (see
 * Config\GuestCache). Runs after `cors` and `locale`: the CORS headers are already sent and
 * the locale is part of the key.
 *
 * Only requests with neither `Authorization` nor `Session` are cached: a guest's session
 * changes some answers (their own vote in GET /rating/:id). Place views are counted by a
 * separate write from the browser (POST /places/:id/views), so crawlers count none.
 */
class GuestCacheFilter implements FilterInterface
{
    /** The cache folder when this request missed it (GuestCache::generation()) */
    private static ?int $generation = null;

    public function before(RequestInterface $request, $arguments = null)
    {
        $config = config('GuestCache');

        if (!$this->isCacheable($request, $config)) {
            return null;
        }

        $cache = new GuestCache($config);
        $body  = $cache->get($this->key($request), $this->ttl($request, $config));

        if ($body === null) {
            // A miss is answered by the controller and saved in after(): only into this folder
            self::$generation = $cache->generation();

            return null;
        }

        return service('response')
            ->setStatusCode(200)
            ->setContentType('application/json')
            ->setHeader('X-Guest-Cache', 'HIT')
            ->setBody($body);
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $config = config('GuestCache');

        if (!$config->enabled) {
            return null;
        }

        if ($this->isCacheable($request, $config)) {
            if ($response->getStatusCode() === 200) {
                (new GuestCache($config))->save($this->key($request), (string) $response->getBody(), self::$generation);
            }

            return null;
        }

        $method = strtoupper($request->getMethod());

        if (
            !in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)
            && $response->getStatusCode() < 400
            && $this->longestMatch($this->path($request), $config->privateWrites) === null
        ) {
            (new GuestCache($config))->flush();
        }

        return null;
    }

    private function isCacheable(RequestInterface $request, GuestCacheConfig $config): bool
    {
        return $config->enabled
            && strtoupper($request->getMethod()) === 'GET'
            && !$this->hasToken($request)
            && trim(str_replace('"', '', $request->getHeaderLine('Session'))) === ''
            && in_array($this->group($request), $config->groups, true);
    }

    /**
     * Read like SessionLibrary does: behind Apache the header may come only as the server
     * variable, and a signed-in user's answer must never reach the guests
     */
    private function hasToken(RequestInterface $request): bool
    {
        $server = $request instanceof IncomingRequest ? (string) $request->getServer('HTTP_AUTHORIZATION') : '';

        return trim($server) !== '' || trim($request->getHeaderLine('Authorization')) !== '';
    }

    /** The locale, the path and the query: the same answer for the same three */
    private function key(RequestInterface $request): string
    {
        $locale = $request instanceof IncomingRequest ? $request->getLocale() : '';
        $query  = (string) $request->getUri()->getQuery();

        return $locale . ' ' . $this->path($request) . '?' . $query;
    }

    /** Seconds the answer is served: its own in $ttls, or the common one */
    private function ttl(RequestInterface $request, GuestCacheConfig $config): int
    {
        $match = $this->longestMatch($this->path($request), array_keys($config->ttls));

        return $match === null ? $config->ttl : $config->ttls[$match];
    }

    /**
     * The longest of the patterns the path starts with, segment by segment, `*` matching
     * any one segment; null when none does
     *
     * @param string[] $patterns
     */
    private function longestMatch(string $path, array $patterns): ?string
    {
        $segments = explode('/', $path);
        $longest  = null;

        foreach ($patterns as $pattern) {
            $parts = explode('/', $pattern);

            if (count($parts) > count($segments) || ($longest !== null && count($parts) <= substr_count($longest, '/') + 1)) {
                continue;
            }

            foreach ($parts as $i => $part) {
                if ($part !== '*' && $part !== $segments[$i]) {
                    continue 2;
                }
            }

            $longest = $pattern;
        }

        return $longest;
    }

    private function group(RequestInterface $request): string
    {
        return explode('/', $this->path($request))[0];
    }

    private function path(RequestInterface $request): string
    {
        $path = $request instanceof IncomingRequest ? $request->getPath() : $request->getUri()->getPath();

        return trim($path, '/');
    }
}
