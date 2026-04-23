<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\LevelsLibrary;
use App\Libraries\SessionLibrary;
use App\Models\UsersModel;
use CodeIgniter\Files\File;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Services;
use Exception;
use ReflectionException;
use Throwable;

/**
 * Users controller
 *
 * Manages user profile retrieval, profile updates (name, website, password,
 * notification settings), and avatar upload/crop workflows.
 *
 * @package App\Controllers
 */
class Users extends ResourceController
{
    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Return a paginated list of users ordered by recent activity.
     *
     * GET /users — optional query params: limit, offset.
     *
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $limit  = abs($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 40);
        $offset = abs($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0);

        $userLevels = new LevelsLibrary();
        $usersModel = new UsersModel();
        
        // Get total count of users
        $totalCount = $usersModel->countAllResults(false);
        
        $usersData  = $usersModel
            ->select('id, name, avatar, created_at, activity_at, updated_at, level, experience, reputation')
            ->orderBy('activity_at, updated_at', 'DESC')
            ->findAll(min($limit, 40), $offset);

        $result = [];

        if (empty($usersData)) {
            return $this->respond([
                'items' => $result,
                'count' => $totalCount
            ]);
        }

        $avatarLibrary = new AvatarLibrary();
        foreach ($usersData as $item) {
            $level    = $userLevels->getLevelData($item);
            $result[] = (object) [
                'id'     => $item->id,
                'name'   => $item->name,
                'avatar' => $avatarLibrary->buildPath($item->id, $item->avatar, 'small'),
                'levelData'  => [
                    'level'      => $level->level,
                    'title'      => $level->title,
                    'experience' => $item->experience,
                    'nextLevel'  => $level->nextLevel,
                ],
                'reputation' => $item->reputation,
                'created'    => $item->created_at,
                'activity'   => $item->activity_at ? new \DateTime($item->activity_at) : null
            ];
        }

        return $this->respond([
            'items' => $result,
            'count' => $totalCount
        ]);
    }

    /**
     * Return the public profile for a single user with level and stat data.
     *
     * GET /users/:id
     * When the authenticated user requests their own profile, private fields
     * are included.
     *
     * @param string|null $id User primary key.
     *
     * @throws ReflectionException
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $userLevels = new LevelsLibrary();
        $usersModel = new UsersModel();
        $usersData  = $usersModel->getUserById($id, $id === $this->session->user?->id);

        if (!$usersData) {
            return $this->failNotFound();
        }

        $userLevels->calculate($usersData);

        $avatarLibrary = new AvatarLibrary();

        $usersData->levelData = $userLevels->getLevelData($usersData);
        $usersData->statistic = $userLevels->statistic;
        $usersData->avatar    = $avatarLibrary->buildPath($usersData->id, $usersData->avatar, 'medium');

        unset($usersData->experience, $usersData->level);

        return $this->respond($usersData);
    }

    /**
     * Update the authenticated user's profile data.
     *
     * PUT /users/:id — auth required; user may only update their own profile.
     * Accepts JSON: name, website, oldPassword + newPassword, and settings object.
     *
     * @param string|null $id User primary key.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function update($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->id !== $id) {
            return $this->failUnauthorized();
        }

        $input = $this->request->getJSON();
        $rules = [
            'name'    => 'if_exist|min_length[6]|max_length[150]|is_unique[users.name]',
            'website' => 'if_exist|max_length[150]|string',
            'oldPassword' => 'if_exist|min_length[8]|max_length[50]',
            'newPassword' => 'if_exist|min_length[8]|max_length[50]'
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        $userModel  = new UsersModel();
        $updateData = [];

        if (isset($input->oldPassword) && isset($input->newPassword)) {
            helper('auth');

            $validatePassword = $userModel
                ->select('password')
                ->where(['email' => $this->session->user?->email, 'auth_type' => AUTH_TYPE_NATIVE])
                ->first();

            if (!password_verify($input->oldPassword, $validatePassword->password)) {
                return $this->failValidationErrors(lang('Users.passwordComparisonFail'));
            }

            $updateData['password'] = hashUserPassword($input->newPassword);
        }

        if (isset($input->name)) {
            $updateData['name'] = $input->name;
        }

        if (isset($input->website)) {
            $updateData['website'] = $input->website;
        }

        if (isset($input->settings)) {
            $defaultSettings = ['emailComment', 'emailEdit', 'emailPhoto', 'emailRating', 'emailCover', 'emailDigest'];

            $updateData['settings'] = json_encode((object) array_combine($defaultSettings, array_map(function($setting) use ($input) {
                $inputValue   = isset($input->settings->$setting) && is_bool($input->settings->$setting) ? $input->settings->$setting : null;
                $sessionValue = $this->session->settings->$setting ?? true;

                return $inputValue !== null ? $inputValue : $sessionValue;
            }, $defaultSettings)));
        }

        if (empty($updateData)) {
            return $this->failValidationErrors(lang('Users.noDataForUpdate'));
        }

        $userModel->update($id, $updateData);

        return $this->respondUpdated();
    }

    /**
     * Upload a new avatar image to the temporary directory for cropping.
     *
     * POST /users/avatar — auth required.
     * Validates MIME type (JPEG, PNG, WebP) and max size (5 MB).
     * Resizes to max avatar dimensions before returning the temporary path.
     *
     * @return ResponseInterface
     */
    public function avatar(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        if (!$photo = $this->request->getFile('avatar')) {
            return $this->failValidationErrors(lang('Users.noPhotoForUpload'));
        }

        if (!$this->validate([
            'avatar' => 'uploaded[avatar]|mime_in[avatar,image/jpeg,image/png,image/webp]|max_size[avatar,5120]'
        ])) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        if (!$photo->hasMoved()) {
            try {
                if (!is_dir(UPLOAD_TEMPORARY)) {
                    mkdir(UPLOAD_TEMPORARY, 0777, true);
                }

                $filename = $this->session->user->id . '.' . $photo->getExtension();
                $photo->move(UPLOAD_TEMPORARY, $filename, true);

                list($width, $height) = getimagesize(UPLOAD_TEMPORARY . $filename);

                // Calculating Aspect Ratio
                $orientation = $width > $height ? 'h' : 'v';
                $width  = $orientation === 'h' ? $width : $height;
                $height = $orientation === 'h' ? $height : $width;

                // If the uploaded image dimensions exceed the maximum
                if ($width > AVATAR_MAX_WIDTH || $height > AVATAR_MAX_HEIGHT) {
                    $image = Services::image('gd');
                    $image->withFile(UPLOAD_TEMPORARY . $filename)
                        ->fit(AVATAR_MAX_WIDTH, AVATAR_MAX_HEIGHT)
                        ->reorient(true)
                        ->save(UPLOAD_TEMPORARY . $filename);

                    list($width, $height) = getimagesize(UPLOAD_TEMPORARY . $filename);
                }

                return $this->respondCreated([
                    'filename' => $filename,
                    'filepath' => PATH_TEMPORARY . $filename,
                    'width'    => $width,
                    'height'   => $height
                ]);
            } catch (Throwable $e) {
                log_message('error', '{exception}', ['exception' => $e]);
                return $this->failServerError(lang('Users.avatarProcessingError'));
            }
        }

        return $this->failValidationErrors($photo->getErrorString());
    }

    /**
     * Crop the uploaded avatar and save small and medium variants.
     *
     * POST /users/crop — auth required.
     * Expects JSON with filename (from the avatar upload step) and crop
     * coordinates: x, y, width, height.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function crop(): ResponseInterface
    {
        $usersModel = new UsersModel();

        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        if (!$user = $usersModel->find($this->session->user?->id)) {
            return $this->failValidationErrors(lang('Users.userNotFound'));
        }

        $input = $this->request->getJSON();

        if (!isset($input->x) ||
            !isset($input->y) ||
            !isset($input->width) ||
            !isset($input->height) ||
            !isset($input->filename) ||
            !file_exists(UPLOAD_TEMPORARY . $input->filename))
        {
            return $this->failValidationErrors(lang('Users.incorrectAvatarData'));
        }

        if ($input->width < AVATAR_SMALL_WIDTH || $input->height < AVATAR_SMALL_HEIGHT) {
            return $this->failValidationErrors(lang('Users.smallAvatarDimensions', [AVATAR_SMALL_WIDTH, AVATAR_SMALL_HEIGHT]));
        }

        $userAvatarDir = UPLOAD_AVATARS . $user->id . '/';
        $avatarLibrary = new AvatarLibrary();

        // Remove old avatar
        if ($user->avatar) {
            $avatarLibrary->deleteOld($user->id, $user->avatar);
        }

        try {
            if (!is_dir($userAvatarDir)) {
                mkdir($userAvatarDir, 0777, true);
            }

            $file = new File(UPLOAD_TEMPORARY . $input->filename);
            $rand = $file->getRandomName();
            $file->move(UPLOAD_AVATARS . $user->id, $rand, true);

            $name  = explode('.', $rand);
            $image = Services::image('gd'); // imagick
            $image->withFile($userAvatarDir . $rand)
                ->crop($input->width, $input->height, $input->x, $input->y)
                ->resize(AVATAR_SMALL_WIDTH, AVATAR_SMALL_HEIGHT)
                ->save($userAvatarDir . $name[0] . '_small.' . $name[1]);

            $image->withFile($userAvatarDir . $rand)
                ->crop($input->width, $input->height, $input->x, $input->y)
                ->resize(AVATAR_MEDIUM_WIDTH, AVATAR_MEDIUM_HEIGHT)
                ->save($userAvatarDir . $name[0] . '_medium.' . $name[1]);

            $usersModel->update($user->id, ['avatar' => $rand]);

            return $this->respondUpdated(['filepath' => PATH_AVATARS . $user->id . '/' . $name[0] . '_medium.' . $name[1]]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Users.avatarProcessingError'));
        }
    }
}