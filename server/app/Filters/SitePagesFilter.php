<?php

namespace App\Filters;

use App\Libraries\SitePages;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * After a successful write, asks the site to render the pages it changed anew (see
 * App\Libraries\SitePages); after a failed one forgets them.
 */
class SitePagesFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        if (in_array(strtoupper($request->getMethod()), ['GET', 'HEAD', 'OPTIONS'], true) || $response->getStatusCode() >= 400) {
            SitePages::reset();

            return null;
        }

        SitePages::send();

        return null;
    }
}
