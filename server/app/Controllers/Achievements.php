<?php

namespace App\Controllers;

use App\Controllers\Concerns\AdminOnly;
use App\Entities\AchievementEntity;
use App\Libraries\AdminImageLibrary;
use App\Libraries\AvatarLibrary;
use App\Libraries\AchievementsLibrary;
use App\Libraries\SessionLibrary;
use App\Models\AchievementsModel;
use App\Models\UsersAchievementsModel;
use App\Models\UsersModel;
use Config\Database;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;

/**
 * Achievements controller
 *
 * Manages the achievements catalogue and tracks per-user progress and earnings.
 * Admin-restricted write operations are included (create, update, delete, uploadImage).
 *
 * @package App\Controllers
 */
class Achievements extends ResourceController
{
    use AdminOnly;

    private SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Return a filterable list of active achievements with optional auth context.
     *
     * GET /achievements
     * Optional query params: tier, type.
     *
     * @return ResponseInterface
     */
    public function index(): ResponseInterface
    {
        $locale   = $this->request->getLocale();
        $tier     = $this->request->getGet('tier');
        $type     = $this->request->getGet('type');

        $achievementsModel = new AchievementsModel();
        $query             = $achievementsModel->where('is_active', 1)->orderBy('sort_order', 'ASC');

        if ($tier) {
            $query->where('tier', $tier);
        }
        if ($type) {
            $query->where('type', $type);
        }

        $achievements = $query->findAll();

        $earnedMap   = [];
        $progressMap = [];

        if ($this->session->isAuth && $this->session->user?->id) {
            $userAchievementsModel = new UsersAchievementsModel();
            $earned = $userAchievementsModel
                ->where('user_id', $this->session->user->id)
                ->findAll();

            foreach ($earned as $e) {
                $earnedMap[$e->achievement_id] = $e->earned_at;
            }

            $achievementsLib = new AchievementsLibrary();
            $progressMap     = $achievementsLib->getProgress($this->session->user->id);
        }

        $result = [];
        $now    = date('Y-m-d H:i:s');

        foreach ($achievements as $achievement) {
            if ($this->isHidden($achievement, isset($earnedMap[$achievement->id]), $now)) {
                continue;
            }

            $rules = is_string($achievement->rules)
                ? json_decode($achievement->rules, true)
                : $achievement->rules;

            $item = (object) [
                'id'           => $achievement->id,
                'group_slug'   => $achievement->group_slug,
                'type'         => $achievement->type,
                'tier'         => $achievement->tier,
                'title'        => $achievement->{"title_$locale"} ?? $achievement->title_en,
                'description'  => $achievement->{"description_$locale"} ?? $achievement->description_en,
                'image'        => $achievement->image,
                'xp_bonus'     => (int) $achievement->xp_bonus,
                'season_start' => $achievement->season_start,
                'season_end'   => $achievement->season_end,
                'rules'        => $rules,
                'earned_at'    => $earnedMap[$achievement->id] ?? null,
            ];

            if ($this->session->isAuth && isset($progressMap[$achievement->id])) {
                $item->progress = $progressMap[$achievement->id];
            }

            $result[] = $item;
        }

        return $this->respond(['data' => $result]);
    }

    /**
     * Return a single achievement by ID.
     *
     * GET /achievements/:id
     *
     * @param int|string|null $id Achievement primary key.
     *
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        if (!$id) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $achievementsModel = new AchievementsModel();
        $achievement       = $achievementsModel->find($id);

        if (!$achievement) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $locale = $this->request->getLocale();
        $rules  = is_string($achievement->rules)
            ? json_decode($achievement->rules, true)
            : $achievement->rules;

        return $this->respond((object) [
            'id'           => $achievement->id,
            'group_slug'   => $achievement->group_slug,
            'type'         => $achievement->type,
            'tier'         => $achievement->tier,
            'title'        => $achievement->{"title_$locale"} ?? $achievement->title_en,
            'description'  => $achievement->{"description_$locale"} ?? $achievement->description_en,
            'image'        => $achievement->image,
            'xp_bonus'     => (int) $achievement->xp_bonus,
            'season_start' => $achievement->season_start,
            'season_end'   => $achievement->season_end,
            'rules'        => $rules,
            'is_active'    => (bool) $achievement->is_active,
        ]);
    }

    /**
     * Return the authenticated user's achievement progress map.
     *
     * GET /achievements/progress — auth required.
     *
     * @return ResponseInterface
     */
    public function progress(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $achievementsLib = new AchievementsLibrary();
        $progressMap     = $achievementsLib->getProgress($this->session->user->id);

        return $this->respond(['data' => $progressMap]);
    }

    /**
     * Every achievement a profile shows with that user's `earned_at`: the cheap list of the
     * hexagons — no progress, nothing is counted (one query of the earned ones). The progress of
     * one achievement comes with its card: `userAchievementGroup()`.
     *
     * GET /users/:id/achievements — public endpoint.
     */
    public function userAchievements(string $userId): ResponseInterface
    {
        $locale = $this->request->getLocale();
        $earned = $this->earnedMap($userId);
        $now    = date('Y-m-d H:i:s');
        $result = [];

        foreach ((new AchievementsModel())->where('is_active', 1)->orderBy('sort_order', 'ASC')->findAll() as $achievement) {
            if (!$this->isHidden($achievement, isset($earned[$achievement->id]), $now)) {
                $result[] = $this->userItem($achievement, $locale, $earned[$achievement->id] ?? null);
            }
        }

        return $this->respond(['data' => $result]);
    }

    /**
     * One achievement of a profile with all its steps, each with that user's `earned_at` and
     * `progress` counted now (each rule apart): the card of the award. The costly request — one
     * achievement at a time, only when its card is opened.
     *
     * GET /users/:id/achievements/:group — public; `:group` is the `group_slug`, or the id of an
     * achievement without a group.
     */
    public function userAchievementGroup(string $userId, string $group): ResponseInterface
    {
        // The progress is counted live, rule by rule: not for an id nobody has
        if (!(new UsersModel())->select('id')->find($userId)) {
            return $this->failNotFound();
        }

        $steps = (new AchievementsModel())
            ->where('is_active', 1)
            ->groupStart()
                ->where('group_slug', $group)
                ->orGroupStart()->where('id', $group)->groupStart()->where('group_slug', '')->orWhere('group_slug', null)->groupEnd()->groupEnd()
            ->groupEnd()
            ->orderBy('sort_order', 'ASC')
            ->findAll();

        $earned = $this->earnedMap($userId);
        $now    = date('Y-m-d H:i:s');
        $steps  = array_values(array_filter($steps, fn ($step) => !$this->isHidden($step, isset($earned[$step->id]), $now)));

        if ($steps === []) {
            return $this->failNotFound();
        }

        $locale   = $this->request->getLocale();
        $progress = (new AchievementsLibrary())->progressOf($userId, $steps);
        $result   = [];

        foreach ($steps as $step) {
            $item = $this->userItem($step, $locale, $earned[$step->id] ?? null);

            if (isset($progress[$step->id])) {
                $item->progress = $progress[$step->id];
            }

            $result[] = $item;
        }

        return $this->respond(['data' => $result]);
    }

    /** @return array<string, mixed> achievement id => the day it was earned */
    private function earnedMap(string $userId): array
    {
        $map = [];

        foreach ((new UsersAchievementsModel())->select('achievement_id, earned_at')->where('user_id', $userId)->findAll() as $row) {
            $map[$row->achievement_id] = $row->earned_at;
        }

        return $map;
    }

    /** An achievement as a profile shows it */
    private function userItem(object $achievement, string $locale, mixed $earnedAt): object
    {
        return (object) [
            'id'           => $achievement->id,
            'group_slug'   => $achievement->group_slug,
            'type'         => $achievement->type,
            'tier'         => $achievement->tier,
            'title'        => $achievement->{"title_$locale"} ?? $achievement->title_en,
            'description'  => $achievement->{"description_$locale"} ?? $achievement->description_en,
            'image'        => $achievement->image,
            'xp_bonus'     => (int) $achievement->xp_bonus,
            'sort_order'   => (int) $achievement->sort_order,
            'season_start' => $achievement->season_start,
            'season_end'   => $achievement->season_end,
            'earned_at'    => $earnedAt,
        ];
    }

    /**
     * An award a profile does not list: the award of a season that is over and was not
     * earned — it cannot be earned any more.
     */
    private function isHidden(object $achievement, bool $earned, string $now): bool
    {
        return $achievement->type === 'seasonal' && !$earned && $achievement->season_end && $now > $achievement->season_end;
    }

    /**
     * Return the full achievement list for admin management (includes inactive and all locales).
     *
     * GET /achievements/manage — admin only.
     *
     * @return ResponseInterface
     */
    public function manage(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $locale            = $this->request->getLocale();
        $achievementsModel = new AchievementsModel();
        $achievements      = $achievementsModel->orderBy('sort_order', 'ASC')->findAll();

        $holders = [];

        foreach (Database::connect()->table('users_achievements')
            ->select('achievement_id, COUNT(*) AS holders')
            ->groupBy('achievement_id')
            ->get()->getResultArray() as $row) {
            $holders[$row['achievement_id']] = (int) $row['holders'];
        }

        $result = [];

        foreach ($achievements as $achievement) {
            $rules = is_string($achievement->rules)
                ? json_decode($achievement->rules, true)
                : $achievement->rules;

            $createdAt = $achievement->created_at ?? null;

            $result[] = (object) [
                'id'             => $achievement->id,
                'group_slug'     => $achievement->group_slug,
                'type'           => $achievement->type,
                'tier'           => $achievement->tier,
                'title'          => $achievement->{"title_$locale"} ?? $achievement->title_en,
                'title_en'       => $achievement->title_en,
                'title_ru'       => $achievement->title_ru,
                'description'    => $achievement->{"description_$locale"} ?? $achievement->description_en,
                'description_en' => $achievement->description_en,
                'description_ru' => $achievement->description_ru,
                'image'          => $achievement->image,
                'xp_bonus'       => (int) $achievement->xp_bonus,
                'sort_order'     => (int) $achievement->sort_order,
                'season_start'   => $achievement->season_start,
                'season_end'     => $achievement->season_end,
                'rules'          => $rules,
                'is_active'      => (bool) $achievement->is_active,
                'holders'        => $holders[$achievement->id] ?? 0,
                'created_at'     => $createdAt === null
                    ? null
                    : ($createdAt instanceof \DateTimeInterface ? $createdAt->format('Y-m-d H:i:s') : (string) $createdAt),
            ];
        }

        return $this->respond(['data' => $result]);
    }

    /**
     * The latest earned awards across the site, latest first.
     *
     * GET /achievements/manage/recent?limit=5 — admin only. Default 5, at most 20.
     *
     * @return ResponseInterface
     */
    public function recent(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $locale = $this->request->getLocale() === 'en' ? 'en' : 'ru';
        $limit  = max(1, min(20, (int) ($this->request->getGet('limit') ?? 5) ?: 5));

        $rows = Database::connect()->table('users_achievements ua')
            ->select('ua.id, ua.earned_at, a.id AS achievement_id, a.title_en, a.title_ru, a.image, a.tier, a.group_slug, '
                . 'u.id AS user_id, u.name, u.avatar, u.level')
            ->join('achievements a', 'a.id = ua.achievement_id')
            ->join('users u', 'u.id = ua.user_id AND u.deleted_at IS NULL')
            ->orderBy('ua.earned_at', 'DESC')
            ->orderBy('ua.id', 'DESC')
            ->limit($limit)
            ->get()->getResultArray();

        $avatars = new AvatarLibrary();
        $items   = [];

        foreach ($rows as $row) {
            $title = $row["title_$locale"] ?: ($row['title_ru'] ?: $row['title_en']);

            $items[] = [
                'id'          => $row['id'],
                'earned_at'   => $row['earned_at'],
                'achievement' => [
                    'id'         => $row['achievement_id'],
                    'title'      => $title,
                    'image'      => $row['image'],
                    'tier'       => $row['tier'],
                    'group_slug' => $row['group_slug'],
                ],
                'user'        => [
                    'id'        => $row['user_id'],
                    'name'      => $row['name'],
                    'avatar'    => $avatars->buildPath($row['user_id'], $row['avatar'], 'small'),
                    'levelData' => ['level' => (int) $row['level']],
                ],
            ];
        }

        return $this->respond(['items' => $items]);
    }

    /**
     * Create a new achievement record.
     *
     * POST /achievements — admin only.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function create(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $input = $this->adminInput(true);

        if ($input === null) {
            return $this->failValidationErrors(lang('Achievements.badBody'));
        }

        if (empty($input)) {
            return $this->failValidationErrors(lang('Achievements.createError'));
        }

        [$fields, $errors] = AchievementsLibrary::validateAchievement($input);

        if ($errors) {
            return $this->failValidationErrors($errors);
        }

        $achievementsModel = new AchievementsModel();
        $entity            = new AchievementEntity();

        $entity->group_slug     = $fields['group_slug'];
        $entity->type           = $fields['type'];
        $entity->tier           = $fields['tier'];
        $entity->title_en       = $fields['title_en'] ?? '';
        $entity->title_ru       = $fields['title_ru'];
        $entity->description_en = $fields['description_en'] ?? null;
        $entity->description_ru = $fields['description_ru'] ?? null;
        $entity->image          = $fields['image'] ?? null;
        // A native array: the entity's `json-array` cast encodes it once
        $entity->rules          = $fields['rules'] ?? [];
        $entity->season_start   = $fields['season_start'] ?? null;
        $entity->season_end     = $fields['season_end'] ?? null;
        $entity->xp_bonus       = $fields['xp_bonus'] ?? 0;
        $entity->sort_order     = $fields['sort_order'] ?? 0;
        $entity->is_active      = $fields['is_active'] ?? 1;

        try {
            $achievementsModel->insert($entity);
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Achievements.createError'));
        }

        $created = $achievementsModel->find($achievementsModel->getLastGeneratedId());

        // The rules or the set of achievements changed: everyone's progress with them
        AchievementsLibrary::forgetAllProgress();

        return $this->respondCreated($created);
    }

    /**
     * Update an existing achievement.
     *
     * PUT /achievements/:id — admin only.
     *
     * @param int|string|null $id Achievement primary key.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function update($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        if (!$id) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $achievementsModel = new AchievementsModel();
        $achievement       = $achievementsModel->find($id);

        if (!$achievement) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $input = $this->adminInput(true);

        if ($input === null) {
            return $this->failValidationErrors(lang('Achievements.badBody'));
        }

        [$updateData, $errors] = AchievementsLibrary::validateAchievement($input, [
            'type'         => $achievement->type,
            'season_start' => $achievement->season_start,
            'season_end'   => $achievement->season_end,
        ]);

        if ($errors) {
            return $this->failValidationErrors($errors);
        }

        if (!$updateData) {
            return $this->failValidationErrors(lang('Achievements.nothingToUpdate'));
        }

        if (array_key_exists('rules', $updateData)) {
            $updateData['rules'] = json_encode($updateData['rules']);
        }

        try {
            $achievementsModel->update($id, $updateData);
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Achievements.updateError'));
        }

        // The picture was replaced or taken off: the old file goes
        if (array_key_exists('image', $updateData) && $updateData['image'] !== $achievement->image) {
            $this->dropImage($achievement->image, (string) $id);
        }

        $updated = $achievementsModel->find($id);

        // Decode rules for response
        if ($updated && is_string($updated->rules)) {
            $updated->rules = json_decode($updated->rules, true);
        }

        // The rules or the set of achievements changed: everyone's progress with them
        AchievementsLibrary::forgetAllProgress();

        return $this->respond($updated);
    }

    /**
     * Delete an achievement.
     *
     * DELETE /achievements/:id — admin only.
     * Soft-deletes (is_active = 0) when users have already earned the achievement;
     * hard-deletes otherwise.
     *
     * @param int|string|null $id Achievement primary key.
     *
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        if (!$id) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $achievementsModel     = new AchievementsModel();
        $userAchievementsModel = new UsersAchievementsModel();

        $achievement = $achievementsModel->find($id);

        if (!$achievement) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        try {
            $hasEarners = $userAchievementsModel->where('achievement_id', $id)->countAllResults() > 0;

            if ($hasEarners) {
                $achievementsModel->update($id, ['is_active' => 0]);
            } else {
                $achievementsModel->delete($id);
                $this->dropImage($achievement->image, (string) $id);
            }
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Achievements.deleteError'));
        }

        // The rules or the set of achievements changed: everyone's progress with them
        AchievementsLibrary::forgetAllProgress();

        return $this->respondDeleted(['id' => $id]);
    }

    /**
     * Upload and attach a badge image (PNG or SVG) to an achievement.
     *
     * POST /achievements/:id/image — admin only.
     *
     * @param int|string|null $id Achievement primary key.
     *
     * @return ResponseInterface
     */
    public function uploadImage($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        if (!$id) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $achievementsModel = new AchievementsModel();
        $achievement       = $achievementsModel->find($id);

        if (!$achievement) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $file = $this->request->getFile('image');

        if (!$file || !$file->isValid()) {
            return $this->failValidationErrors(lang('Achievements.noImage'));
        }

        $type = AdminImageLibrary::kind($file);

        if ($type === null) {
            return $this->failValidationErrors(lang('Achievements.badImageFile'));
        }

        $imagePath = AdminImageLibrary::store($file, $type, 'achievements', (string) $id);

        if ($imagePath === null) {
            log_message('error', 'Achievements: image of {id} not saved', ['id' => $id]);

            return $this->failServerError(lang('Achievements.saveImageError'));
        }

        $achievementsModel->update($id, ['image' => $imagePath]);
        $this->dropImage($achievement->image, (string) $id);

        return $this->respond(['id' => $id, 'image' => $imagePath]);
    }

    /**
     * Deletes a badge file of the achievements' folder unless another achievement shows it too.
     */
    private function dropImage(?string $path, string $exceptId): void
    {
        if (!AdminImageLibrary::isOwnPath($path, 'achievements')) {
            return;
        }

        $shared = (new AchievementsModel())->where('image', $path)->where('id !=', $exceptId)->countAllResults();

        if (!$shared) {
            AdminImageLibrary::remove($path, 'achievements');
        }
    }
}
