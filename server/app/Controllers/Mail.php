<?php

namespace App\Controllers;

use App\Controllers\Concerns\AdminOnly;
use App\Libraries\Mail\MailQueue;
use App\Libraries\Mail\UnsubscribeToken;
use App\Libraries\NotificationSettings;
use App\Libraries\SessionLibrary;
use App\Models\SendingMail;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;
use Throwable;

/**
 * Unsubscribing from notification emails.
 *
 * Every email carries a signed token (App\Libraries\Mail\UnsubscribeToken)
 * naming the user and the scope: a notification type, `activity` (all
 * activity on the user's places) or `all`. The token is in the footer link
 * (the /unsubscribe page) and in the List-Unsubscribe header, whose one-click
 * POST (RFC 8058) mail clients send straight here.
 *
 * Opening a link changes nothing (GET only reads), so link scanners in mail
 * clients cannot unsubscribe anyone.
 *
 * And the state of the email queue for the admin dashboard (GET /mail/queue).
 *
 * @package App\Controllers
 */
class Mail extends ResourceController
{
    use AdminOnly;

    private const CHANNEL = 'email';

    /** Only for the admin endpoint: the unsubscribe links need no session */
    private SessionLibrary $session;

    /**
     * Whether the emails go out: when the `notifications:send` job last got through the queue
     * (UTC, null when unknown) and the numbers of SendingMail::health().
     *
     * GET /mail/queue — admin only, never cached.
     *
     * @return ResponseInterface {last_run_at, sent_day, pending, overdue, errors_week}
     */
    public function queue(): ResponseInterface
    {
        $this->session = new SessionLibrary();

        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        try {
            $lastRun = cache(MailQueue::LAST_RUN_CACHE_KEY);

            return $this->respond([
                'last_run_at' => is_int($lastRun) ? gmdate('Y-m-d H:i:s', $lastRun) : null,
                ...(new SendingMail())->health(),
            ]);
        } catch (Throwable $e) {
            log_message('error', '[Mail] The queue state failed: {exception}', ['exception' => $e]);

            return $this->failServerError();
        }
    }

    /**
     * What a link unsubscribes from, and whether it is still on.
     *
     * GET /mail/unsubscribe?token=…
     *
     * @return ResponseInterface {token, scope, subscribed}
     */
    public function status(): ResponseInterface
    {
        $target = $this->resolve();

        if (!$target) {
            return $this->failValidationErrors(lang('Mail.invalidLink'));
        }

        return $this->respond([
            'token'      => $target['token'],
            'scope'      => $target['scope'],
            'subscribed' => (new NotificationSettings())->isScopeEnabled($target['user']->settings ?? null, self::CHANNEL, $target['scope']),
        ]);
    }

    /**
     * Turn the emails of the token's scope off, or of every type with `scope: all`.
     *
     * POST /mail/unsubscribe?token=… (the RFC 8058 one-click form post), or
     * JSON {token, scope?: 'all'} from the /unsubscribe page.
     *
     * @return ResponseInterface {scope, subscribed: false}
     */
    public function unsubscribe(): ResponseInterface
    {
        $target = $this->resolve();

        if (!$target) {
            return $this->failValidationErrors(lang('Mail.invalidLink'));
        }

        $scope    = $this->input('scope') === 'all' ? 'all' : $target['scope'];
        $settings = (new NotificationSettings())->disable($target['user']->settings ?? null, self::CHANNEL, $scope);

        // Not through the model: users.updated_at is the profile's "last modified" (sitemap)
        Database::connect()->table('users')
            ->where('id', $target['user']->id)
            ->update(['settings' => json_encode($settings)]);

        return $this->respond(['scope' => $scope, 'subscribed' => false]);
    }

    /**
     * The user and scope of the request's token.
     *
     * @return array{user: object, scope: string, token: string}|null
     */
    private function resolve(): ?array
    {
        $tokens = new UnsubscribeToken();
        $parsed = $tokens->parse($this->input('token'));

        $settings = new NotificationSettings();

        // The scope must cover some email type (a push-only type is not emailed, so not unsubscribable here)
        if (!$parsed || !array_intersect($settings->typesOfScope($parsed['type']), $settings->channelTypes(self::CHANNEL))) {
            return null;
        }

        $user = (new UsersModel())->select('id, settings')->find($parsed['userId']);

        if (!$user) {
            return null;
        }

        return [
            'user'  => $user,
            'scope' => $parsed['type'],
            'token' => $tokens->create($parsed['userId'], $parsed['type']),
        ];
    }

    /**
     * A parameter from the query string, a form post or a JSON body.
     */
    private function input(string $name): ?string
    {
        $value = $this->request->getGet($name) ?? $this->request->getPost($name);

        if ($value === null && str_contains($this->request->getHeaderLine('Content-Type'), 'json')) {
            try {
                $value = $this->request->getJsonVar($name);
            } catch (Throwable) {
                $value = null;
            }
        }

        return is_string($value) && $value !== '' ? $value : null;
    }
}
