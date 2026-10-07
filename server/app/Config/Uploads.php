<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Uploaded files (place photos, covers, avatars).
 *
 * Paths live in Config\Constants (UPLOADS, UPLOAD_PHOTOS, PATH_PHOTOS, ...).
 */
class Uploads extends BaseConfig
{
    /**
     * Check that a cover file exists on this server before returning its URL.
     *
     * Leave `true` in production, where the API and the files share a host. Set to
     * `false` for a local stand that uses a production database dump with images served
     * from another host (client `NEXT_PUBLIC_IMG_HOST`), otherwise every cover is dropped
     * from API responses because the file is not on the local disk.
     *
     * .env: `uploads.verifyFiles = false`
     */
    public bool $verifyFiles = true;
}
