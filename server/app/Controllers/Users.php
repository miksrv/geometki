<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\LevelsLibrary;
use App\Libraries\NotificationSettings;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Models\UsersModel;
use App\Models\VisitsModel;
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
    /** How many place covers a user's card in the people list shows */
    private const PLACES_ON_CARD = 4;

    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Return a paginated list of users ordered by recent activity.
     *
     * GET /users — optional query params: limit, offset, search, sort, order, places (1: the
     * newest places with a cover of each user, see latestPlaces()).
     *
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        // At least one: `limit=0` would drop the LIMIT and put every user into the IN lists below
        $limit  = max(1, min(abs((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 40)), 40));
        $offset = abs($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0);
        $search = trim((string) ($this->request->getGet('search') ?? ''));

        $allowedSortFields = ['created_at', 'activity_at', 'reputation', 'experience'];
        $sortRaw  = $this->request->getGet('sort') ?? '';
        $orderRaw = strtoupper((string) ($this->request->getGet('order') ?? ''));

        $sort  = in_array($sortRaw, $allowedSortFields, true) ? $sortRaw : 'activity_at';
        $order = in_array($orderRaw, ['ASC', 'DESC'], true) ? $orderRaw : 'DESC';

        $userLevels = new LevelsLibrary();
        $usersModel = new UsersModel();

        // Bot accounts make automated edits, they are not members of the community
        $usersModel->where('role !=', 'bot');

        if ($search !== '') {
            $usersModel->like('name', $search);
        }

        $totalCount = $usersModel->countAllResults(false);

        if ($search !== '') {
            $usersModel->like('name', $search);
        }

        $usersData  = $usersModel
            ->select('id, name, avatar, created_at, activity_at, updated_at, level, experience, reputation')
            ->orderBy($sort, $order)
            // A tie-breaker: equal experience or reputation would otherwise come in any order,
            // so pages could repeat or skip people and the ranking numbers would drift
            ->orderBy('id', 'ASC')
            ->findAll($limit, $offset);

        $result = [];

        if (empty($usersData)) {
            return $this->respond([
                'items' => $result,
                'count' => $totalCount
            ]);
        }

        // Bulk query: activity stats (photo + place counts) per user
        $userIds = array_column(array_map(fn($u) => ['id' => $u->id], $usersData), 'id');
        $db = \Config\Database::connect();

        $activityStats = [];
        if (!empty($userIds)) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $activityRows = $db->query(
                "SELECT user_id,
                    SUM(CASE WHEN type = 'photo' THEN 1 ELSE 0 END) AS photo,
                    SUM(CASE WHEN type = 'place' THEN 1 ELSE 0 END) AS `place`
                 FROM activity
                 WHERE user_id IN ($placeholders)
                 GROUP BY user_id",
                $userIds
            )->getResultObject();
            foreach ($activityRows as $row) {
                $activityStats[$row->user_id] = $row;
            }
        }

        // Bulk query: visited places per user (a place with several visits counts once)
        $visitedStats = [];
        if (!empty($userIds)) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $visitedRows = $db->query(
                "SELECT user_id, COUNT(DISTINCT place_id) AS visited FROM users_visited_places WHERE user_id IN ($placeholders) GROUP BY user_id",
                $userIds
            )->getResultObject();
            foreach ($visitedRows as $row) {
                $visitedStats[$row->user_id] = (int) $row->visited;
            }
        }

        // Only the people page shows the covers: the home page widget asks without them
        $latestPlaces = $this->request->getGet('places') === '1' ? $this->latestPlaces($userIds) : null;

        $avatarLibrary = new AvatarLibrary();
        foreach ($usersData as $item) {
            $level = $userLevels->getLevelData($item);
            $card  = (object) [
                'id'     => $item->id,
                'name'   => $item->name,
                'avatar' => $avatarLibrary->buildPath($item->id, $item->avatar, 'small'),
                'levelData'  => [
                    'level'           => $level->level,
                    'experience'      => $item->experience,
                    'levelExperience' => $level->levelExperience,
                    'nextLevel'       => $level->nextLevel,
                ],
                'reputation' => $item->reputation,
                'created'    => $item->created_at,
                'activity'   => $item->activity_at ? new \DateTime($item->activity_at) : null,
                'statistic'  => [
                    'photo'   => (int) ($activityStats[$item->id]->photo ?? 0),
                    'place'   => (int) ($activityStats[$item->id]->place ?? 0),
                    'visited' => $visitedStats[$item->id] ?? 0,
                ],
            ];

            if ($latestPlaces !== null) {
                $card->places = $latestPlaces[$item->id] ?? [];
            }

            $result[] = $card;
        }

        return $this->respond([
            'items' => $result,
            'count' => $totalCount
        ]);
    }

    /**
     * The newest places with a cover of each user, for the strip of covers on their card in the
     * people list: one windowed query and one texts query for the whole page, however many
     * places the users have.
     *
     * @param array<int, string> $userIds
     * @return array<string, array<int, array>> userId => [{id, slug, category, title, cover}, ...]
     */
    protected function latestPlaces(array $userIds): array
    {
        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        // Twice as many candidates as covers: a place whose cover file is missing gives way to
        // the next one instead of leaving its frame empty
        $rows = \Config\Database::connect()->query(
            "SELECT id, slug, category, user_id, photos, cover_external_id, updated_at
               FROM (SELECT id, slug, category, user_id, photos, cover_external_id, updated_at,
                            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS n
                       FROM places
                      WHERE user_id IN ($placeholders) AND deleted_at IS NULL
                        AND (photos > 0 OR (cover_external_id IS NOT NULL AND cover_external_id <> ''))) p
              WHERE p.n <= " . (self::PLACES_ON_CARD * 2) . '
              ORDER BY user_id, n',
            $userIds
        )->getResultObject();

        if (empty($rows)) {
            return [];
        }

        // Titles only: a one-character cut keeps the descriptions out of the query
        $texts = new PlacesContent(1);
        $texts->translate(array_column($rows, 'id'));

        $formatter = new PlaceFormatterLibrary();
        $result    = [];

        foreach ($rows as $row) {
            // A full strip first: the spare candidates never reach the file check
            if (count($result[$row->user_id] ?? []) >= self::PLACES_ON_CARD) {
                continue;
            }

            $cover = $formatter->formatCover($row->id, (int) $row->photos, $row->cover_external_id);

            if (!$cover) {
                continue;
            }

            $result[$row->user_id][] = [
                'id'       => $row->id,
                'slug'     => $row->slug,
                'category' => $row->category,
                'title'    => $texts->title($row->id),
                // The preview path stays the same when the cover changes: the update time versions it
                'cover'    => ['preview' => $cover['preview'] . '?d=' . strtotime((string) $row->updated_at)],
            ];
        }

        return $result;
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

        // Only a read: the experience and the level are kept up to date by the actions
        // (a view is far more frequent than a change)
        $avatarLibrary = new AvatarLibrary();

        $usersData->levelData = $userLevels->getLevelData($usersData);
        $usersData->statistic = $userLevels->statistic($usersData->id);
        $usersData->avatar    = $avatarLibrary->buildPath($usersData->id, $usersData->avatar, 'medium');

        // Visits are a log: the distinct places, and all the check-ins
        $visitsRow = (new VisitsModel())
            ->select('COUNT(DISTINCT place_id) AS visited, COUNT(*) AS visits', false)
            ->where('user_id', $id)
            ->first();
        $usersData->statistic->visited = (int) ($visitsRow->visited ?? 0);
        $usersData->statistic->visits  = (int) ($visitsRow->visits ?? 0);

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

        if (isset($input->settings) && (is_object($input->settings) || is_array($input->settings))) {
            $stored = $userModel->select('settings')->find($id)?->settings;

            $updateData['settings'] = json_encode((new NotificationSettings())->merge($stored, $input->settings));
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