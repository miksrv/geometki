<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Web push (VAPID) keys, from `.env`:
 *   push.vapidPublicKey, push.vapidPrivateKey — generate with `php spark push:vapid`
 *   push.vapidSubject — a mailto: or https: contact for the push services
 * Without the keys push is off: nothing is queued and the API says so.
 */
class Push extends BaseConfig
{
    public string $vapidPublicKey  = '';
    public string $vapidPrivateKey = '';
    public string $vapidSubject    = 'mailto:info@geometki.com';

    public function isConfigured(): bool
    {
        return $this->vapidPublicKey !== '' && $this->vapidPrivateKey !== '';
    }
}
