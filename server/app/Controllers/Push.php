<?php

namespace App\Controllers;

use App\Libraries\Push\PushEndpoint;
use App\Libraries\Push\PushQueue;
use App\Libraries\SessionLibrary;
use App\Models\PushSubscriptionsModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Services;
use DateTimeZone;
use Throwable;

/**
 * Web push devices.
 *
 * A browser's push subscription belongs to the user who enabled push on that
 * device. Removing and renewing a subscription take the endpoint itself as the
 * proof: the service worker that renews it has no auth token, and signing out
 * must be able to remove it after the token is gone.
 *
 * @package App\Controllers
 */
class Push extends ResourceController
{
    /** Push services are https URLs; anything else is not a subscription */
    private const ENDPOINT_MAX = 2048;

    /** Devices with push on per user: the oldest goes when another is added */
    private const DEVICES_MAX = 10;

    /** Test pushes per user per minute */
    private const TESTS_PER_MINUTE = 3;

    private SessionLibrary $session;
    private PushSubscriptionsModel $subscriptions;

    public function __construct()
    {
        $this->session       = new SessionLibrary();
        $this->subscriptions = new PushSubscriptionsModel();
    }

    /**
     * The VAPID public key the browser subscribes with.
     *
     * GET /push/key
     *
     * @return ResponseInterface {publicKey: string|null}
     */
    public function key(): ResponseInterface
    {
        $config = config('Push');

        return $this->respond(['publicKey' => $config->isConfigured() ? $config->vapidPublicKey : null]);
    }

    /**
     * Whether this device's subscription is on for the signed-in user.
     *
     * GET /push/subscriptions/status?endpoint=… — auth required.
     *
     * @return ResponseInterface {active: bool, devices: int}
     */
    public function status(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $endpoint = (string) $this->request->getGet('endpoint');
        $row      = $endpoint !== '' ? $this->subscriptions->findByEndpoint($endpoint) : null;

        return $this->respond([
            'active'  => $row !== null && $row->user_id === $this->session->user->id,
            'devices' => $this->subscriptions->where('user_id', $this->session->user->id)->countAllResults(),
        ]);
    }

    /**
     * Turn push on for this device: store (or take over) its subscription.
     *
     * POST /push/subscriptions — auth required.
     * Body: {endpoint, keys: {p256dh, auth}, contentEncoding?, timezone?}
     *
     * @return ResponseInterface
     */
    public function subscribe(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        if (!config('Push')->isConfigured()) {
            log_message('error', 'Push: VAPID keys (push.* in .env) are not set');

            return $this->failServerError(lang('Push.notConfigured'));
        }

        $input = $this->subscriptionInput($this->jsonInput());

        if ($input === null) {
            return $this->failValidationErrors(lang('Push.invalidSubscription'));
        }

        // A missing or invalid time zone keeps the one stored before
        $this->save($input + array_filter([
            'user_id'    => $this->session->user->id,
            'timezone'   => $this->timezone($this->jsonInput()['timezone'] ?? null),
            'locale'     => $this->request->getLocale(),
            'user_agent' => mb_substr((string) $this->request->getUserAgent(), 0, 255),
        ], static fn ($value) => $value !== null && $value !== ''));

        $this->dropOldestDevices($this->session->user->id);

        return $this->respondCreated(['active' => true]);
    }

    /**
     * Turn push off for this device.
     *
     * DELETE /push/subscriptions — body {endpoint}; no auth (the endpoint is the proof).
     *
     * @return ResponseInterface
     */
    public function unsubscribe(): ResponseInterface
    {
        $endpoint = (string) ($this->jsonInput()['endpoint'] ?? '');

        if ($endpoint !== '') {
            $this->subscriptions->where('endpoint_hash', PushSubscriptionsModel::hash($endpoint))->delete();
            // Turned off on purpose: the browser must not bring it back by renewing it
            $this->subscriptions->forgetExpired($endpoint);
        }

        return $this->respond(['active' => false]);
    }

    /**
     * The browser replaced the subscription (`pushsubscriptionchange` in the
     * service worker): move the record to the new one. The old one may already be
     * gone, deleted on a 404/410 from the push service: its owner is then taken from
     * `push_subscriptions_expired`.
     *
     * POST /push/subscriptions/renew — body {oldEndpoint, subscription: {endpoint, keys}}; no auth.
     *
     * @return ResponseInterface
     */
    public function renew(): ResponseInterface
    {
        $body        = $this->jsonInput();
        $oldEndpoint = (string) ($body['oldEndpoint'] ?? '');
        $input       = $this->subscriptionInput(is_array($body['subscription'] ?? null) ? $body['subscription'] : []);
        $old         = $oldEndpoint !== '' ? $this->subscriptions->findByEndpoint($oldEndpoint) : null;
        $old       ??= $oldEndpoint !== '' ? $this->subscriptions->findExpired($oldEndpoint, config('Notifications')->expiredSubscriptionDays) : null;

        if (!$old || $input === null) {
            return $this->failNotFound();
        }

        // The new record first, the old one after: a failure in between keeps the device
        $this->save($input + [
            'user_id'    => $old->user_id,
            'timezone'   => $old->timezone,
            'locale'     => $old->locale,
            'user_agent' => $old->user_agent,
        ]);

        if ($old->endpoint_hash !== $input['endpoint_hash'] && isset($old->id)) {
            $this->subscriptions->delete($old->id);
        }

        $this->subscriptions->forgetExpired($oldEndpoint);
        $this->dropOldestDevices($old->user_id);

        return $this->respond(['active' => true]);
    }

    /**
     * A test push to every device of the signed-in user, at once.
     *
     * POST /push/test — auth required.
     *
     * @return ResponseInterface {sent: int, devices: int}
     */
    public function test(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $queue = new PushQueue();

        if (!$queue->isConfigured()) {
            log_message('error', 'Push: VAPID keys (push.* in .env) are not set');

            return $this->failServerError(lang('Push.notConfigured'));
        }

        if (!Services::throttler()->check('push_test_' . $this->session->user->id, self::TESTS_PER_MINUTE, MINUTE)) {
            return $this->failTooManyRequests(lang('Push.tooManyTests'));
        }

        try {
            $result = $queue->sendTest($this->session->user->id, $this->request->getLocale());
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Push.testFailed'));
        }

        if ($result['devices'] === 0) {
            return $this->failNotFound(lang('Push.noSubscriptions'));
        }

        return $this->respond($result);
    }

    /**
     * Insert, or update the row of the same endpoint (a device re-enabling push,
     * or another account taking the device over).
     */
    private function save(array $data): void
    {
        $existing = $this->subscriptions->where('endpoint_hash', $data['endpoint_hash'])->first();

        if (!$existing) {
            try {
                $this->subscriptions->insert($data);

                return;
            } catch (DatabaseException) {
                // The same device saved by a parallel request in between: update that row
                $existing = $this->subscriptions->where('endpoint_hash', $data['endpoint_hash'])->first();

                if (!$existing) {
                    throw new \RuntimeException('Could not save the push subscription');
                }
            }
        }

        $this->subscriptions->update($existing->id, $data + ['failures' => 0]);
    }

    /**
     * Keep at most DEVICES_MAX devices per user: the least recently updated go.
     */
    private function dropOldestDevices(string $userId): void
    {
        $ids = array_column(
            $this->subscriptions->select('id')->where('user_id', $userId)->orderBy('updated_at', 'DESC')->findAll(),
            'id'
        );

        if (count($ids) > self::DEVICES_MAX) {
            $this->subscriptions->whereIn('id', array_slice($ids, self::DEVICES_MAX))->delete();
        }
    }

    /**
     * @return array{endpoint: string, endpoint_hash: string, p256dh: string, auth: string, content_encoding: string}|null
     */
    private function subscriptionInput(array $body): ?array
    {
        $endpoint = $body['endpoint'] ?? null;
        $p256dh   = $body['keys']['p256dh'] ?? null;
        $auth     = $body['keys']['auth'] ?? null;
        $encoding = $body['contentEncoding'] ?? 'aes128gcm';

        $isKey = static fn ($value) => is_string($value) && preg_match('/^[A-Za-z0-9_\-=+\/]{8,255}$/', $value);

        if (
            !is_string($endpoint) || strlen($endpoint) > self::ENDPOINT_MAX
            || filter_var($endpoint, FILTER_VALIDATE_URL) === false || !PushEndpoint::isAllowed($endpoint)
            || !$isKey($p256dh) || !$isKey($auth)
            || !in_array($encoding, ['aes128gcm', 'aesgcm'], true)
        ) {
            return null;
        }

        return [
            'endpoint'         => $endpoint,
            'endpoint_hash'    => PushSubscriptionsModel::hash($endpoint),
            'p256dh'           => $p256dh,
            'auth'             => $auth,
            'content_encoding' => $encoding,
        ];
    }

    private function timezone(mixed $value): ?string
    {
        if (!is_string($value) || $value === '' || strlen($value) > 64) {
            return null;
        }

        try {
            return (new DateTimeZone($value))->getName();
        } catch (Throwable) {
            return null;
        }
    }

    private function jsonInput(): array
    {
        try {
            $body = $this->request->getJSON(true);
        } catch (Throwable) {
            $body = null;
        }

        return is_array($body) ? $body : [];
    }
}
