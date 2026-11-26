<?php

/**
 * PHP's own upload checks know only requests made by a web server, never a test's file.
 * Defined in the namespace of CodeIgniter's UploadedFile, these stand in for them: the tests
 * that upload a file include this file.
 */

namespace CodeIgniter\HTTP\Files;

if (!function_exists(__NAMESPACE__ . '\is_uploaded_file')) {
    function is_uploaded_file(string $path): bool
    {
        return is_file($path);
    }

    function move_uploaded_file(string $from, string $to): bool
    {
        return rename($from, $to);
    }
}
