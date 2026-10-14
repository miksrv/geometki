<?php

namespace App\Libraries\Push;

/**
 * Which URLs a push subscription may point at. The server POSTs to a subscription's
 * endpoint, so only the browsers' push services are accepted: any other URL would let a
 * user make the server call it (an internal address, a port scan).
 */
class PushEndpoint
{
    /** The push services of the browsers; a subdomain of one counts */
    public const HOSTS = [
        'fcm.googleapis.com',            // Chrome, Edge, Opera, Samsung Internet
        'android.googleapis.com',        // older Chrome
        'push.services.mozilla.com',     // Firefox (updates.push.services.mozilla.com)
        'push.apple.com',                // Safari (web.push.apple.com)
        'notify.windows.com',            // Edge on Windows (*.notify.windows.com)
    ];

    /**
     * https on the default port, no credentials, a known push host.
     */
    public static function isAllowed(string $endpoint): bool
    {
        $parts = parse_url($endpoint);

        if (!$parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
            || isset($parts['user']) || isset($parts['pass']) || (isset($parts['port']) && $parts['port'] !== 443)) {
            return false;
        }

        $host = strtolower(rtrim($parts['host'], '.'));

        // parse_url keeps characters that HTTP clients read as a path ("evil.com\.fcm.googleapis.com")
        if (!preg_match('/^[a-z0-9.-]+$/', $host)) {
            return false;
        }

        foreach (self::HOSTS as $allowed) {
            if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                return true;
            }
        }

        return false;
    }
}
