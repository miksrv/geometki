<?php

namespace App\Controllers;

use App\Entities\UserEntity;
use App\Libraries\AvatarLibrary;
use App\Libraries\Mail\MagicLinkMail;
use App\Libraries\Mail\Mailer;
use App\Libraries\Mail\MailUrls;
use App\Libraries\GoogleClient;
use App\Libraries\LevelsLibrary;
use App\Libraries\SessionLibrary;
use App\Libraries\VkClient;
use App\Libraries\YandexClient;
use App\Models\MagicLinkTokensModel;
use App\Models\UsersModel;
use CodeIgniter\Files\File;
use CodeIgniter\HTTP\IncomingRequest;
use GuzzleHttp\Client as GuzzleClient;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\Validation\Exceptions\ValidationException;
use Config\Services;
use Exception;
use ReflectionException;
use Throwable;

/**
 * Auth controller
 *
 * Handles native registration/login and OAuth flows for Google, VK, and Yandex.
 * Returns a JWT token on successful authentication.
 *
 * @package App\Controllers
 */
class Auth extends ResourceController
{
    private SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Register a new user with name, email, and password.
     *
     * POST /auth/registration
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function registration(): ResponseInterface
    {
        if ($this->session->isAuth) {
            return $this->failForbidden(lang('Auth.alreadyAuthorized'));
        }

        $validationRules = [
            'name'     => 'required|is_unique[users.name]',
            'email'    => 'required|min_length[6]|max_length[50]|valid_email|is_unique[users.email]',
            'password' => 'required|min_length[8]|max_length[50]'
        ];

        $input = $this->getRequestInput($this->request);

        if (!$this->validateRequest($input, $validationRules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        helper('auth');

        $userModel = new UsersModel();
        $user      = new UserEntity();
        $user->id        = $userModel->createId();
        $user->name      = $input['name'];
        $user->email     = $input['email'];
        $user->password  = hashUserPassword($input['password']);
        $user->auth_type = AUTH_TYPE_NATIVE;
        $user->level     = 1;

        try {
            $userModel->save($user);

            unset($user->password);

            $this->session->authorization($user);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Auth.registrationError'));
        }

        return $this->responseAuth();
    }


    /**
     * Initiate or complete Google OAuth authentication.
     *
     * GET /auth/google — redirects to Google when no code is present;
     * exchanges the code for a profile on callback.
     *
     * @link https://console.developers.google.com/
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function google(): ResponseInterface
    {
        if ($this->session->isAuth) {
            return $this->failForbidden(lang('Auth.alreadyAuthorized'));
        }

        $serviceClient = new GoogleClient(
            getenv('auth.google.clientID'),
            getenv('auth.google.secret'),
            getenv('auth.google.redirect')
        );

        $code = $this->request->getGet('code', FILTER_SANITIZE_SPECIAL_CHARS);

        // If there is no authorization code, then the user has not yet logged in to Yandex.
        if (!$code) {
            return $this->respond([
                'auth'     => false,
                'redirect' => $serviceClient->createAuthUrl(),
            ]);
        }

        try {
            $serviceProfile = $serviceClient->authUser($code);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Auth.serviceAuthError'));
        }

        return $this->serviceAuth(AUTH_TYPE_GOOGLE, $serviceProfile);
    }


    /**
     * Initiate or complete VK OAuth authentication.
     *
     * GET /auth/vk — redirects to VK when no code is present;
     * exchanges the code for a profile on callback.
     *
     * @link https://vk.com/dev/authcode_flow_user
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function vk(): ResponseInterface
    {
        if ($this->session->isAuth) {
            return $this->failForbidden(lang('Auth.alreadyAuthorized'));
        }

        $serviceClient = new VkClient(
            getenv('auth.vk.clientID'),
            getenv('auth.vk.secret'),
            getenv('auth.vk.redirect'),
        );

        $code   = $this->request->getGet('code', FILTER_SANITIZE_SPECIAL_CHARS);
        $state  = $this->request->getGet('state', FILTER_SANITIZE_SPECIAL_CHARS);
        $device = $this->request->getGet('device_id', FILTER_SANITIZE_SPECIAL_CHARS);

        // If there is no authorization code, then the user has not yet logged in to Yandex.
        if (!$code) {
            return $this->respond([
                'auth'     => false,
                'redirect' => $serviceClient->createAuthUrl(),
            ]);
        }

        try {
            $serviceProfile = $serviceClient->authUser($code, $state, $device);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Auth.serviceAuthError'));
        }

        return $this->serviceAuth(AUTH_TYPE_VK, $serviceProfile);
    }


    /**
     * Initiate or complete Yandex OAuth authentication.
     *
     * GET /auth/yandex — redirects to Yandex when no code is present;
     * exchanges the code for a profile on callback.
     *
     * @link https://oauth.yandex.ru/
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function yandex(): ResponseInterface
    {
        if ($this->session->isAuth) {
            return $this->failForbidden(lang('Auth.alreadyAuthorized'));
        }

        $serviceClient = new YandexClient(
            getenv('auth.yandex.clientID'),
            getenv('auth.yandex.secret'),
            getenv('auth.yandex.redirect')
        );

        $code = $this->request->getGet('code', FILTER_SANITIZE_SPECIAL_CHARS);

        // If there is no authorization code, then the user has not yet logged in to Yandex.
        if (!$code) {
            return $this->respond([
                'auth'     => false,
                'redirect' => $serviceClient->createAuthUrl(),
            ]);
        }

        try {
            $serviceProfile = $serviceClient->authUser($code);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Auth.serviceAuthError'));
        }

        return $this->serviceAuth(AUTH_TYPE_YANDEX, $serviceProfile);
    }


    /**
     * Authenticate an existing native user with email and password.
     *
     * POST /auth/login
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function login(): ResponseInterface
    {
        if ($this->session->isAuth) {
            return $this->failForbidden(lang('Auth.alreadyAuthorized'));
        }

        $rules = [
            'email'    => 'required|min_length[6]|max_length[50]|valid_email',
            'password' => 'required|min_length[8]|max_length[50]|validateUser[email, password]'
        ];

        $errors = [
            'password' => [
                'validateUser' => lang('Auth.invalidCredentials')
            ]
        ];

        $input = $this->getRequestInput($this->request);

        if (!$this->validateRequest($input, $rules, $errors)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        $userModel = new UsersModel();
        $userData  = $userModel->findUserByEmailAddress($input['email']);

        try {
            $this->session->authorization($userData);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Auth.registrationError'));
        }

        return $this->responseAuth();
    }


    /**
     * Requests a passwordless login link by email. Always responds with the
     * same generic success shape regardless of whether the email is
     * registered, malformed-but-valid, or currently rate-limited — this
     * endpoint must never reveal account existence.
     *
     * POST /auth/magic-link
     *
     * @return ResponseInterface
     */
    public function requestMagicLink(): ResponseInterface
    {
        if ($this->session->isAuth) {
            return $this->failForbidden(lang('Auth.alreadyAuthorized'));
        }

        $rules = [
            'email' => 'required|valid_email|max_length[255]',
        ];

        $input = $this->getRequestInput($this->request);

        if (!$this->validateRequest($input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        $email      = strtolower(trim($input['email']));
        $returnPath = $this->sanitizeReturnPath($input['returnPath'] ?? null);
        $ip         = $this->request->getIPAddress();

        $tokenModel = new MagicLinkTokensModel();

        if (!$tokenModel->isRateLimited($email, $ip)) {
            $rawToken = $tokenModel->createToken($email, $returnPath, $ip);

            $locale = $this->request->getLocale();
            $link   = MailUrls::site($locale, '/auth?token=' . $rawToken . ($returnPath !== null ? '&return=' . rawurlencode($returnPath) : ''));

            try {
                (new Mailer())->send(MagicLinkMail::build($email, $link, $locale));
            } catch (Throwable $e) {
                log_message('error', '[Auth] Failed to send magic link email: {exception}', ['exception' => $e]);
            }
        }

        return $this->respond(['sent' => true]);
    }


    /**
     * Verifies a magic-link token and logs the user in, creating the account
     * on first use. Deliberately does not enforce the OAuth auth_type
     * mismatch check from `serviceAuth()` — proving mailbox ownership is
     * treated as strictly stronger than any OAuth provider's email claim.
     *
     * POST /auth/magic-link/verify
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function verifyMagicLink(): ResponseInterface
    {
        if ($this->session->isAuth) {
            return $this->failForbidden(lang('Auth.alreadyAuthorized'));
        }

        $input = $this->getRequestInput($this->request);
        $token = $input['token'] ?? null;

        if (empty($token)) {
            return $this->failValidationErrors(lang('Auth.magicLinkInvalidOrExpired'));
        }

        $claim = (new MagicLinkTokensModel())->consumeToken($token);

        if (!$claim) {
            return $this->failValidationErrors(lang('Auth.magicLinkInvalidOrExpired'));
        }

        [$userData, $isNewUser] = (new UsersModel())->findOrCreateByEmail($claim['email'], AUTH_TYPE_EMAIL);

        try {
            $this->session->authorization($userData);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Auth.registrationError'));
        }

        return $this->responseAuth($isNewUser);
    }


    /**
     * Keeps only a same-origin relative path (no scheme/host), to prevent an
     * attacker-supplied returnPath from being embedded in the emailed link
     * and used as an open redirect.
     *
     * @param string|null $returnPath
     * @return string|null
     */
    private function sanitizeReturnPath(?string $returnPath): ?string
    {
        if (empty($returnPath) || !str_starts_with($returnPath, '/') || str_contains($returnPath, '://')) {
            return null;
        }

        return $returnPath;
    }


    /**
     * Return the current session status and user data.
     *
     * GET /auth/me — refreshes the JWT token when it is within 5 minutes of expiry.
     * Marks a signed-in visitor active; a guest's call writes nothing. A request from the client's SSR (`X-SSR` header) carries the
     * Next server's IP, not the visitor's: it marks only the signed-in user, not the session.
     *
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function me(): ResponseInterface
    {
        // A guest only reads: no session is started here (their first score starts one) and none
        // is refreshed. A bot or a page rendered for a guest (the admin pages ask auth/me) used
        // to make a new session row on every call
        if (!$this->session->isAuth) {
            return $this->respond((object) ['session' => $this->session->id, 'auth' => false]);
        }

        if ($this->request->getHeaderLine('X-SSR') === '' || !$this->session->id) {
            $this->session->update();
        } else {
            // A page rendered for a signed-in user (the home page) hands the browser this answer,
            // so the browser does not ask itself: without this the user never looked online
            $this->session->markUserActiveFromServer();
        }

        $response = (object) [
            'session' => $this->session->id,
            'auth'    => $this->session->isAuth
        ];

        if ($this->session->isAuth && $this->session->user) {
            $response->user = $this->responseUser();

            // Only regenerate token if within 5 minutes of expiry (SEC-02)
            $existingToken = $this->request->getHeaderLine('Authorization');
            $existingToken = str_replace('Bearer ', '', $existingToken);
            $shouldRefresh = true;

            if ($existingToken) {
                $parts = explode('.', $existingToken);
                if (count($parts) === 3) {
                    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
                    if (isset($payload['exp']) && ($payload['exp'] - time()) > 300) {
                        $shouldRefresh = false;
                    }
                }
            }

            $response->token = $shouldRefresh ? generateAuthToken($this->session->user->email) : $existingToken;
        }

        return $this->respond($response);
    }


    /**
     * Validate arbitrary input against a rule set.
     *
     * Accepts either a rule array or a named group from Config\Validation.
     * Populates $this->validator so callers can retrieve errors via
     * $this->validator->getErrors().
     *
     * @param mixed  $input    Associative array of values to validate.
     * @param array|string $rules   Rule array or validation group name.
     * @param array  $messages Custom error messages keyed by field.rule.
     *
     * @return bool True when validation passes.
     */
    public function validateRequest(mixed $input, array|string $rules, array $messages = []): bool
    {
        $this->validator = Services::Validation()->setRules($rules);
        // If you replace the $rules array with the name of the group
        if (is_string($rules)) {
            $validation = config('Validation');

            // If the rule wasn't found in the \Config\Validation, we
            // should throw an exception so the developer can find it.
            if (!isset($validation->$rules)) {
                throw ValidationException::forRuleNotFound($rules);
            }

            // If no error message is defined, use the error message in the Config\Validation file
            if (!$messages) {
                $errorName = $rules . '_errors';
                $messages = $validation->$errorName ?? [];
            }

            $rules = $validation->$rules;
        }

        return $this->validator->setRules($rules, $messages)->run($input);
    }


    /**
     * Extract the request payload from POST fields or JSON body.
     *
     * @param IncomingRequest $request The current HTTP request.
     *
     * @return mixed Associative array of submitted values.
     */
    public function getRequestInput(IncomingRequest $request): mixed
    {
        $input = $request->getPost();

        if (empty($input)) {
            //convert request body to associative array
            $input = json_decode($request->getBody(), true);
        }

        return $input;
    }


    /**
     * Complete OAuth authentication for a third-party service.
     *
     * Creates the user account if it does not exist, downloads the remote avatar
     * via Guzzle, then issues a session and JWT token.
     *
     * @param string      $authType       One of the AUTH_TYPE_* constants.
     * @param object|null $serviceProfile Profile object returned by the OAuth client.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    protected function serviceAuth(string $authType, ?object $serviceProfile): ResponseInterface
    {
        if (empty($serviceProfile) || empty($serviceProfile->email)) {
            return $this->failValidationErrors(lang('Auth.authServiceEmptyData'));
        }

        // Successful authorization, look for a user with the same email in the database
        $userModel = new UsersModel();
        $userData  = $userModel->findUserByEmailAddress($serviceProfile->email);

        // If there is no user with this email, then register a new user
        if (empty($userData)) {
            $createUser = new UserEntity();
            $createUser->name      = $serviceProfile->name;
            $createUser->email     = $serviceProfile->email;
            $createUser->auth_type = $authType;
            $createUser->locale    = !empty($serviceProfile->locale) ? $serviceProfile->locale : $locale = $this->request->getLocale();

            // TODO
            // $user->sex      = $serviceProfile->sex ?? null;
            // $user->birthday = $serviceProfile->birthday ?? null;

            $userModel->insert($createUser);

            $newUserId = $userModel->getInsertID();

            // If a service user has an avatar, download it securely via Guzzle (SEC-19)
            if ($serviceProfile->avatar && str_starts_with($serviceProfile->avatar, 'https://')) {
                try {
                    if (!is_dir(UPLOAD_TEMPORARY)) {
                        mkdir(UPLOAD_TEMPORARY, 0777, true);
                    }

                    $tempFilename = $newUserId . '.jpg';
                    $tempPath     = UPLOAD_TEMPORARY . $tempFilename;

                    $guzzle = new GuzzleClient([
                        'timeout'         => 10,
                        'connect_timeout' => 5,
                        'allow_redirects' => ['max' => 3],
                    ]);
                    $guzzle->get($serviceProfile->avatar, ['sink' => $tempPath]);

                    $avatarLibrary = new AvatarLibrary();
                    $newFilename   = $avatarLibrary->processUpload($newUserId, $tempPath);

                    $userModel->update($newUserId, ['avatar' => $newFilename]);

                    $createUser->avatar = $newFilename;
                } catch (\Throwable $e) {
                    // Avatar download failure is non-fatal — user is still logged in without avatar
                    log_message('warning', 'Failed to download OAuth avatar: {message}', ['message' => $e->getMessage()]);
                }
            }

            $userData     = $createUser;
            $userData->id = $newUserId;
        }

        // All migrated users will not have an authorization type in the database, so it will be possible to
        // either recover the password or log in through Google or another system.
        // But if the authorization type is already specified, you should authorize only this way.
        if ($userData->auth_type !== null && $userData->auth_type !== $authType) {
            return $this->failValidationErrors(lang('Auth.authWrongService'));
        }

        if ($userData->auth_type !== $authType) {
            $userModel->update($userData->id, ['auth_type' => $authType]);
        }

        $this->session->authorization($userData);

        return $this->responseAuth();
    }

    /**
     * Build the standard authentication success response with session, user, and token.
     *
     * @param bool $isNewUser Set when the account was just created via the
     *                        magic-link flow; adds `isNewUser` to the response
     *                        so the frontend can route accordingly. Omitted
     *                        (false) by every other caller, so their response
     *                        shape is unchanged.
     * @return ResponseInterface
     */
    protected function responseAuth(bool $isNewUser = false): ResponseInterface
    {
        $response = [
            'session' => $this->session->id,
            'auth'    => $this->session->isAuth,
            'token'   => generateAuthToken($this->session->user->email),
            'user'    => $this->responseUser(),
        ];

        if ($isNewUser) {
            $response['isNewUser'] = true;
        }

        return $this->respond($response);
    }

    /**
     * The signed-in user as every auth answer gives it: with the level data, without the
     * password, the auth type and the raw level and experience. `auth/me` and the sign-in
     * answers share it, so the app bar shows the same right after a sign-in as after a reload.
     *
     * @return UserEntity
     */
    private function responseUser(): UserEntity
    {
        $user      = $this->session->user;
        $userLevel = (new LevelsLibrary())->getLevelData($user);

        $user->levelData = [
            'level'           => $userLevel?->level,
            'experience'      => $user->experience,
            'levelExperience' => $userLevel?->levelExperience,
            'nextLevel'       => $userLevel?->nextLevel,
        ];

        unset($user->password, $user->auth_type, $user->level, $user->experience);

        return $user;
    }
}
