<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class CacheHeadersFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null): void {}

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): ResponseInterface
    {
        $maxAge = $arguments[0] ?? 300;
        // The response starts with the framework's no-cache header: replaced, not joined
        $response->removeHeader('Cache-Control')->setHeader('Cache-Control', "public, max-age={$maxAge}");
        return $response;
    }
}
