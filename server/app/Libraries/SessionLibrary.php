<?php namespace App\Libraries;

use App\Entities\UserEntity;
use App\Models\SessionsHistoryModel;
use App\Models\SessionsModel;
use App\Models\UsersModel;
use Config\Services;
use JetBrains\PhpStorm\NoReturn;
use ReflectionException;

class SessionLibrary {
    public string | null $id = null;
    public float | null $lat = null;
    public float | null $lon = null;
    public UserEntity | null $user = null;
    public object | null $settings = null;
    public bool $isAuth = false;

    private \CodeIgniter\HTTP\IncomingRequest|\CodeIgniter\HTTP\CLIRequest $request;
    private SessionsModel $model;
    private string $ip;

    public function __construct() {
        helper('auth');

        $this->model   = new SessionsModel();
        $this->request = Services::request();

        $token   = $this->request->getServer('HTTP_AUTHORIZATION') ?? null;
        $session = $this->request->getHeaderLine('Session') ?? null;

        $this->ip   = $this->request->getIPAddress();
        $this->user = validateAuthToken($token);

//        if (
//            $this->request->getUserAgent()->getAgentString() === 'node' &&
//            $this->ip === $this->request->getServer('REMOTE_ADDR')
//        ) {
//            return ;
//        }

        if ($this->user) {
            $this->isAuth = true;
            $this->model->where('user_id', $this->user->id);
            $this->settings = $this->user->settings;

            unset($this->user->password, $this->user->settings);
        } else {
            if ($session) {
                $this->model->where('id', str_replace('"', '', $session));
            }
            // No session token present: skip lookup — a new session will be created on update()
        }

        $sessionData = $this->model->orderBy('updated_at', 'DESC')->first();

        if ($sessionData) {
            $this->id  = $sessionData->id;
            $this->lat = $sessionData->lat ?? null;
            $this->lon = $sessionData->lon ?? null;
        }

        // Debug logging
//        log_message('debug', 'SessionLibrary: Request = ' . $this->request->getMethod() . ' ' . $this->request->getUri()->getPath());
//        log_message('debug', 'SessionLibrary: Authorization header = ' . ($token ?? 'null'));
//        log_message('debug', 'SessionLibrary: Session header = ' . ($session ?? 'null'));
//        log_message('debug', 'SessionLibrary: User = ' . ($this->user ? json_encode(['id' => $this->user->id, 'name' => $this->user->name ?? null]) : 'null'));
    }

    /**
     * @throws ReflectionException
     */
    public function authorization(UserEntity $user): static {
        unset($user->auth_type);

        $this->user   = $user;
        $this->isAuth = true;
        $this->update();

        return $this;
    }

    /**
     * @throws ReflectionException
     */
    public function update(): static {
        if ($this->user) {
            $usersModel = new UsersModel();
            $usersModel->updateUserActivity($this->user->id);
        }

        if ($this->id) {
            $updateSession = new \App\Entities\SessionEntity();
            $updateSession->updated_at = time();
            $updateSession->user_ip    = $this->ip;

            if ($this->user && $this->user->id) {
                $updateSession->user_id = $this->user->id;
            }

            $this->model->update($this->id, $updateSession);

            return $this;
        }

        $session = new \App\Entities\SessionEntity();
        $session->id      = bin2hex(random_bytes(16));
        $session->user_ip = $this->ip;
        $session->user_id = $this->user ? $this->user->id : null;

        $this->model->insert($session);

        $this->id = $session->id;

        return $this;
    }

    /**
     * @param float $lat
     * @param float $lon
     * @return void
     * @throws ReflectionException
     */
    #[NoReturn] public function updateLocation(float $lat, float $lon): void {
        if ($this->id &&
            $lat && $lon &&
            ($this->lat !== $lat || $this->lon !== $lon)
        ) {
            $model = new SessionsModel();
            $model->update($this->id, [
                'lat' => $lat,
                'lon' => $lon,
            ]);

            if ($this->lat !== null && $this->lon !== null) {
                $historyModel = new SessionsHistoryModel();
                $historyModel->insert([
                    'session_id' => $this->id,
                    'lat'        => $lat,
                    'lon'        => $lon
                ]);
            }

            $this->lat = $lat;
            $this->lon = $lon;
        }
    }
}