<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The page cache of the site (App\Libraries\SitePages): the Next server keeps whole place
 * pages rendered and serves them without asking the API; after a write that changes a place
 * the API asks it to render that page anew. Set in `.env`:
 *
 *   sitepages.secret = '…'   # the same as REVALIDATE_SECRET of the Next server; empty = off
 *   sitepages.url    = 'https://geometki.com/api/revalidate'   # default: app.siteUrl + /api/revalidate
 */
class SitePages extends BaseConfig
{
    public string $secret = '';

    public string $url = '';

    /** Seconds the write waits for the site: it only queues the pages and answers at once */
    public float $timeout = 2.0;

    /** Pages one write renders at most (a renamed collection of hundreds of places): the rest wait for their daily time */
    public int $maxPaths = 100;
}
