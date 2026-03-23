<?php

namespace App\Controllers;

use App\Entities\UserEntity;
use App\Libraries\AvatarLibrary;
use App\Libraries\GoogleClient;
use App\Libraries\LevelsLibrary;
use App\Libraries\SessionLibrary;
use App\Libraries\VkClient;
use App\Libraries\YandexClient;
use App\Models\UsersModel;
use CodeIgniter\Files\File;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\Validation\Exceptions\ValidationException;
use Config\Services;
use Exception;
use ReflectionException;

class Auth extends ResourceController
{
    private SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }


    /**
     * Register a new user
     * @return ResponseInterface
     * @throws ReflectionException
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
        $user->name      = $input['name'];
        $user->email     = $input['email'];
        $user->password  = hashUserPassword($input['password']);
        $user->auth_type = AUTH_TYPE_NATIVE;
        $user->level     = 1;

        $userModel->save($user);

        $user->id = $userModel->getInsertID();

        unset($user->password);

        $this->session->authorization($user);

        return $this->responseAuth();
    }


    /**
     * Auth via Google
     * @link https://console.developers.google.com/
     * @throws ReflectionException
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

        return $this->_serviceAuth(
            AUTH_TYPE_GOOGLE,
            $serviceClient->authUser($code)
        );
    }


    /**
     * Auth via VK
     * @link https://console.developers.google.com/
     * @throws ReflectionException
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

        return $this->_serviceAuth(
            AUTH_TYPE_VK,
            $serviceClient->authUser($code, $state, $device)
        );
    }


    /**
     * Auth via Yandex
     * @link https://oauth.yandex.ru/
     * @return ResponseInterface
     * @throws ReflectionException
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

        return $this->_serviceAuth(
            AUTH_TYPE_YANDEX,
            $serviceClient->authUser($code)
        );
    }


    /**
     * Native authenticate existing user
     * @return ResponseInterface
     * @throws ReflectionException
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

        $this->session->authorization($userData);

        return $this->responseAuth();
    }


    /**
     * @throws Exception
     */
    public function me(): ResponseInterface
    {
        $this->session->update();

        $response = (object) [
            'session' => $this->session->id,
            'auth'    => $this->session->isAuth
        ];

        if ($this->session->isAuth && $this->session->user) {
            $levelsLibrary = new LevelsLibrary();

            $userLevel = $levelsLibrary->getLevelData($this->session->user);

            $this->session->user->levelData = [
                'level'      => $userLevel->level,
                'title'      => $userLevel->title,
                'experience' => $this->session->user->experience,
                'nextLevel'  => $userLevel->nextLevel,
            ];

            $response->user  = $this->session->user;
            $response->token = generateAuthToken($this->session->user->email);

            unset(
                $response->user->password, $response->user->auth_type,
                $response->user->level, $response->user->experience
            );
        }

        return $this->respond($response);
    }


    /**
     * @param $input
     * @param array $rules
     * @param array $messages
     * @return bool
     */
    public function validateRequest($input, array $rules, array $messages = []): bool
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
     * @param IncomingRequest $request
     * @return array|bool|float|int|mixed|object|string|null
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
     * Authorization through the service (Yandex, Google or VK)
     * @param string $authType
     * @param object|null $serviceProfile
     * @return ResponseInterface
     * @throws ReflectionException
     */
    protected function _serviceAuth(string $authType, object | null $serviceProfile): ResponseInterface
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

            // If a Google user has an avatar, copy it
            if ($serviceProfile->avatar) {
                if (!is_dir(UPLOAD_TEMPORARY)) {
                    mkdir(UPLOAD_TEMPORARY, 0777, true);
                }

                $tempFilename = $newUserId . '.jpg';
                $tempPath     = UPLOAD_TEMPORARY . $tempFilename;

                file_put_contents($tempPath, file_get_contents($serviceProfile->avatar));

                $avatarLibrary = new AvatarLibrary();
                $newFilename   = $avatarLibrary->processUpload($newUserId, $tempPath);

                $userModel->update($newUserId, ['avatar' => $newFilename]);
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
     * @return ResponseInterface
     */
    protected function responseAuth(): ResponseInterface
    {
        return $this->respond([
            'session' => $this->session->id,
            'auth'    => $this->session->isAuth,
            'user'    => $this->session->user,
            'token'   => generateAuthToken($this->session->user->email),
        ]);
    }
}