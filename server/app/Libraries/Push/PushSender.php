<?php

namespace App\Libraries\Push;

use Config\Push as PushConfig;
use GuzzleHttp\Client;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use RuntimeException;
use Throwable;

/**
 * Sends one push payload to a user's devices through the browsers' push services
 * (Web Push protocol, VAPID; minishlink/web-push).
 */
class PushSender
{
    private WebPush $webPush;

    public function __construct(?PushConfig $config = null)
    {
        $config ??= config('Push');

        if (!$config->isConfigured()) {
            throw new RuntimeException('Push is not configured: set push.vapidPublicKey and push.vapidPrivateKey');
        }

        $this->webPush = new WebPush(
            ['VAPID' => [
                'subject'    => $config->vapidSubject,
                'publicKey'  => $config->vapidPublicKey,
                'privateKey' => $config->vapidPrivateKey,
            ]],
            [],
            // No redirects: only the push service itself is ever called
            new Client(['timeout' => 10, 'connect_timeout' => 5, 'allow_redirects' => false])
        );

        // One JWT per push service for the whole run
        $this->webPush->setReuseVAPIDHeaders(true);
    }

    /**
     * @param object[] $subscriptions `push_subscriptions` rows
     * @param array    $options       TTL (seconds), urgency (very-low|low|normal|high), topic (replaces an undelivered push with the same topic)
     *
     * @return array<string, array{ok: bool, expired: bool, reason: string}> subscription id => outcome
     */
    public function send(array $subscriptions, array $payload, array $options = []): array
    {
        $body    = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $results = [];

        // One device at a time: a broken one (bad keys) must not stop the others
        foreach ($subscriptions as $subscription) {
            // Never call a URL that is not a push service, whatever got into the table
            if (!PushEndpoint::isAllowed($subscription->endpoint)) {
                $results[$subscription->id] = ['ok' => false, 'expired' => true, 'reason' => 'Not a push service endpoint'];
                continue;
            }

            try {
                $report = $this->webPush->sendOneNotification(
                    new Subscription($subscription->endpoint, $subscription->p256dh, $subscription->auth, $subscription->content_encoding ?: 'aes128gcm'),
                    $body,
                    $options
                );

                $results[$subscription->id] = [
                    'ok'      => $report->isSuccess(),
                    'expired' => $report->isSubscriptionExpired(),
                    'reason'  => $report->isSuccess() ? '' : self::withoutEndpoint($report->getReason(), $subscription->endpoint),
                ];
            } catch (Throwable $e) {
                $results[$subscription->id] = ['ok' => false, 'expired' => false, 'reason' => self::withoutEndpoint($e->getMessage(), $subscription->endpoint)];
            }
        }

        return $results;
    }

    /**
     * An endpoint is a secret (whoever has it can push to the device): keep it out of
     * errors that go to logs and the queue table.
     */
    private static function withoutEndpoint(string $message, string $endpoint): string
    {
        return mb_substr(str_replace($endpoint, '[endpoint]', $message), 0, 500);
    }
}
