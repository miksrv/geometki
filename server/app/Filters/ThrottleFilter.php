<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Simple rate-limiting filter using the CI4 Throttler service.
 *
 * Defaults to 10 requests per minute per IP. Designed for auth endpoints
 * to mitigate brute-force and credential-stuffing attacks.
 */
class ThrottleFilter implements FilterInterface
{
    /** Max requests allowed in the window */
    private int $maxRequests = 10;

    /** Window size in seconds */
    private int $windowSeconds = 60;

    public function before(RequestInterface $request, $arguments = null): ?ResponseInterface
    {
        $throttler = \Config\Services::throttler();
        $ip        = $request->getIPAddress();

        // Sanitize IP for cache key (IPv6 contains colons which are reserved characters)
        $cacheKey = str_replace([':', '.'], ['_', '-'], $ip);

        if (!$throttler->check($cacheKey, $this->maxRequests, $this->windowSeconds)) {
            /** @var \CodeIgniter\HTTP\Response $response */
            $response = \Config\Services::response();

            return $response
                ->setStatusCode(429)
                ->setHeader('Retry-After', (string) $throttler->getTokenTime())
                ->setJSON(['messages' => ['error' => 'Too many requests. Please try again later.']]);
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): void
    {
        //
    }
}
