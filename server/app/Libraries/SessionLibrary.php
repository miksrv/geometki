<?php namespace App\Libraries;

use App\Entities\UserEntity;
use App\Models\SessionsModel;
use App\Models\UsersModel;
use CodeIgniter\I18n\Time;
use Config\Services;
use ReflectionException;

/**
 * The visitor's session: a signed-in user (JWT in `Authorization`) or an anonymous visitor
 * (id in the `Session` header). The session row keeps no coordinates: the visitor's location
 * lives on the client and comes with each request that needs it as explicit `lat`/`lon`.
 */
class SessionLibrary {
    /**
     * How often a returning visitor's session row and the user's `activity_at` are refreshed.
     * The client polls `/auth/me` every minute; the "online" mark on avatars uses a 15-minute window.
     */
    public const UPDATE_INTERVAL = 5 * 60;

    public string | null $id = null;
    public UserEntity | null $user = null;
    public object | null $settings = null;
    public bool $isAuth = false;

    private \CodeIgniter\HTTP\IncomingRequest|\CodeIgniter\HTTP\CLIRequest $request;
    private SessionsModel $model;
    private string $ip;
    private ?object $row = null;
    /** When the signed-in user was last active, kept off the user object the API answers with */
    private mixed $userActivityAt = null;

    public function __construct() {
        helper('auth');

        $this->model   = new SessionsModel();
        $this->request = Services::request();

        $token   = $this->request->getServer('HTTP_AUTHORIZATION') ?? null;
        $session = trim(str_replace('"', '', $this->request->getHeaderLine('Session')));

        $this->ip   = $this->request->getIPAddress();
        $this->user = validateAuthToken($token);

        if ($this->user) {
            $this->isAuth   = true;
            $this->settings = $this->user->settings;

            $this->userActivityAt = $this->user->activity_at;

            unset($this->user->password, $this->user->settings, $this->user->activity_at);

            // This device's session when the client sent it, else the user's latest one: a user
            // on two devices keeps two rows, and their polls do not overwrite each other's IP
            if ($session !== '') {
                $this->row = $this->model
                    ->select('id, user_id, user_ip, updated_at')
                    ->where(['id' => $session, 'user_id' => $this->user->id])
                    ->first();
            }

            $this->row ??= $this->model
                ->select('id, user_id, user_ip, updated_at')
                ->where('user_id', $this->user->id)
                ->orderBy('updated_at', 'DESC')
                ->first();
        } elseif ($session !== '') {
            // An anonymous session that has since been tied to an account is not reused anonymously
            $this->row = $this->model
                ->select('id, user_id, user_ip, updated_at')
                ->where(['id' => $session, 'user_id' => null])
                ->first();
        }
        // No user and no session id: no lookup, a new session is created on update()

        $this->id = $this->row?->id;
    }

    /**
     * @throws ReflectionException
     */
    public function authorization(UserEntity $user): static {
        $this->settings = $user->settings;

        unset($user->auth_type, $user->activity_at, $user->password, $user->settings);

        // The user as a token request gets it (validateAuthToken): the avatar as a path, not the
        // stored file name
        $user->avatar = (new AvatarLibrary())->buildPath($user->id, $user->avatar);

        $this->user   = $user;
        $this->isAuth = true;
        $this->update(true);

        // A sign-in gives an address marked undeliverable another chance: a wrong mark
        // heals itself, a dead mailbox costs one more rejected email at most
        if (!empty($user->id)) {
            \Config\Database::connect()->table('users')
                ->where('id', $user->id)
                ->where('email_bounced_at IS NOT NULL', null, false)
                ->update(['email_bounced_at' => null]);
        }

        return $this;
    }

    /**
     * Mark the visitor as active: refresh the session row (or create one) and the user's
     * `activity_at`. A returning visitor is written at most once per UPDATE_INTERVAL, unless
     * the IP or the signed-in user changed, or $force is set.
     *
     * @throws ReflectionException
     */
    public function update(bool $force = false): static {
        if (!$this->id) {
            $session = new \App\Entities\SessionEntity();
            $session->id      = bin2hex(random_bytes(16));
            $session->user_ip = $this->ip;
            $session->user_id = $this->user?->id;

            $this->model->insert($session);

            $this->id = $session->id;
            $this->markUserActive();

            return $this;
        }

        $userChanged = $this->user && $this->row?->user_id !== $this->user->id;
        $ipChanged   = $this->row?->user_ip !== $this->ip;

        if (!$force && !$userChanged && !$ipChanged && !$this->isStale()) {
            return $this;
        }

        $data = ['user_ip' => $this->ip];

        if ($this->user) {
            $data['user_id'] = $this->user->id;
        }

        $this->model->update($this->id, $data);
        $this->markUserActive();

        return $this;
    }

    /**
     * Mark only the signed-in user active, not the session row: for a request the client's SSR
     * makes on the user's behalf, which carries the Next server's IP. Written at most once per
     * UPDATE_INTERVAL, like update()
     */
    public function markUserActiveFromServer(): void {
        $activityAt = $this->userActivityAt;
        $timestamp  = $activityAt instanceof Time ? $activityAt->getTimestamp() : strtotime((string) $activityAt);

        if ($this->user && (!$timestamp || time() - $timestamp >= self::UPDATE_INTERVAL)) {
            $this->markUserActive();
        }
    }

    /**
     * Save the signed-in user's last known position (not shown anywhere yet). Writes only when
     * the user has moved further than UsersModel::LOCATION_MIN_DISTANCE from the saved point.
     *
     * @return bool Whether the position was saved.
     */
    public function updateLocation(float $lat, float $lon): bool {
        if (!$this->isAuth || !$this->user) {
            return false;
        }

        return (new UsersModel())->updateLastLocation($this->user->id, $lat, $lon);
    }

    private function isStale(): bool {
        $updatedAt = $this->row?->updated_at;

        if (!$updatedAt) {
            return true;
        }

        $timestamp = $updatedAt instanceof Time ? $updatedAt->getTimestamp() : strtotime((string) $updatedAt);

        return time() - $timestamp >= self::UPDATE_INTERVAL;
    }

    private function markUserActive(): void {
        if (!$this->user) {
            return;
        }

        (new UsersModel())->updateUserActivity($this->user->id);
    }
}
