<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Minishlink\WebPush\VAPID;

/**
 * Generate the VAPID key pair web push needs, to paste into `.env`:
 *   php spark push:vapid
 * Generate once: new keys make every existing push subscription useless.
 */
class PushVapid extends BaseCommand
{
    protected $group       = 'notifications';
    protected $name        = 'push:vapid';
    protected $description = 'Generate the VAPID keys for web push (paste them into .env)';

    public function run(array $params)
    {
        $keys = VAPID::createVapidKeys();

        CLI::write('Add to .env (generate once: new keys invalidate every push subscription):', 'yellow');
        CLI::write("push.vapidPublicKey = '{$keys['publicKey']}'");
        CLI::write("push.vapidPrivateKey = '{$keys['privateKey']}'");
        CLI::write("push.vapidSubject = 'mailto:info@geometki.com'");
    }
}
