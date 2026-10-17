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
 * changes some answers (their own vote in GET /rating/:id). So a cached place page counts
 * no view, which is right for the crawlers behind most of them.
 */
class GuestCacheFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $config = config('GuestCache');

        if (!$this->isCacheable($request, $config)) {
            return null;
        }

        $body = (new GuestCache($config))->get($this->key($request));

        if ($body === null) {
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
                (new GuestCache($config))->save($this->key($request), (string) $response->getBody());
            }

            return null;
        }

        $method = strtoupper($request->getMethod());

        if (
            !in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)
            && $response->getStatusCode() < 400
            && !in_array($this->group($request), $config->privateWrites, true)
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
