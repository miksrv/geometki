<?php

namespace App\Libraries\Mail;

use RuntimeException;

/**
 * Signed unsubscribe tokens: `{userId}.{type}.{signature}`, where type is a
 * notification type from Config\Notifications or `all`. The signature is an
 * HMAC-SHA256 with `mail.unsubscribeSecret` (falls back to the JWT secret),
 * so a link works only for the user and type it was issued for, never expires
 * and needs no database row.
 */
class UnsubscribeToken
{
    private string $secret;

    public function __construct(?string $secret = null)
    {
        $secret ??= (string) (env('mail.unsubscribeSecret') ?: env('auth.token.secret'));

        if ($secret === '') {
            throw new RuntimeException('No secret for unsubscribe tokens: set mail.unsubscribeSecret or auth.token.secret');
        }

        $this->secret = $secret;
    }

    public function create(string $userId, string $type): string
    {
        return $userId . '.' . $type . '.' . $this->sign($userId, $type);
    }

    /**
     * @return array{userId: string, type: string}|null null when the token is malformed or forged
     */
    public function parse(?string $token): ?array
    {
        if (!$token || !preg_match('/^([A-Za-z0-9]{1,32})\.([a-z_]{1,32})\.([A-Za-z0-9_-]{16,64})$/', $token, $match)) {
            return null;
        }

        [, $userId, $type, $signature] = $match;

        if (!hash_equals($this->sign($userId, $type), $signature)) {
            return null;
        }

        return ['userId' => $userId, 'type' => $type];
    }

    private function sign(string $userId, string $type): string
    {
        $hash = hash_hmac('sha256', 'unsubscribe|' . $userId . '|' . $type, $this->secret, true);

        return rtrim(strtr(base64_encode(substr($hash, 0, 16)), '+/', '-_'), '=');
    }
}
