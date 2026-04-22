<?php

namespace App\Controllers;

use App\Entities\AchievementEntity;
use App\Libraries\AchievementsLibrary;
use App\Libraries\SessionLibrary;
use App\Models\AchievementsModel;
use App\Models\UsersAchievementsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;

class Achievements extends ResourceController
{
    private SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * GET /achievements
     */
    public function index(): ResponseInterface
    {
        $locale   = $this->request->getLocale();
        $category = $this->request->getGet('category');
        $tier     = $this->request->getGet('tier');
        $type     = $this->request->getGet('type');

        $achievementsModel = new AchievementsModel();
        $query             = $achievementsModel->where('is_active', 1)->orderBy('sort_order', 'ASC');

        if ($category) {
            $query->where('category', $category);
        }
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

        foreach ($achievements as $achievement) {
            $rules = is_string($achievement->rules)
                ? json_decode($achievement->rules, true)
                : $achievement->rules;

            $item = (object) [
                'id'           => $achievement->id,
                'group_slug'   => $achievement->group_slug,
                'type'         => $achievement->type,
                'tier'         => $achievement->tier,
                'category'     => $achievement->category,
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
     * GET /achievements/:id
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
            'category'     => $achievement->category,
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
     * GET /achievements/progress
     * Auth required.
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
     * GET /users/:id/achievements
     * Public — all achievements with this user's earned status and progress.
     */
    public function userAchievements(string $userId): ResponseInterface
    {
        $locale            = $this->request->getLocale();
        $achievementsModel = new AchievementsModel();

        $achievements = $achievementsModel
            ->where('is_active', 1)
            ->orderBy('sort_order', 'ASC')
            ->findAll();

        $userAchievementsModel = new UsersAchievementsModel();
        $earned = $userAchievementsModel
            ->where('user_id', $userId)
            ->findAll();

        $earnedMap = [];
        foreach ($earned as $e) {
            $earnedMap[$e->achievement_id] = $e->earned_at;
        }

        $achievementsLib = new AchievementsLibrary();
        $progressMap     = $achievementsLib->getProgress($userId);

        $result = [];

        foreach ($achievements as $achievement) {
            $item = (object) [
                'id'           => $achievement->id,
                'group_slug'   => $achievement->group_slug,
                'type'         => $achievement->type,
                'tier'         => $achievement->tier,
                'category'     => $achievement->category,
                'title'        => $achievement->{"title_$locale"} ?? $achievement->title_en,
                'description'  => $achievement->{"description_$locale"} ?? $achievement->description_en,
                'image'        => $achievement->image,
                'xp_bonus'     => (int) $achievement->xp_bonus,
                'season_start' => $achievement->season_start,
                'season_end'   => $achievement->season_end,
                'earned_at'    => $earnedMap[$achievement->id] ?? null,
            ];

            if (isset($progressMap[$achievement->id])) {
                $item->progress = $progressMap[$achievement->id];
            }

            $result[] = $item;
        }

        return $this->respond(['data' => $result]);
    }

    /**
     * GET /achievements/manage
     * Admin only.
     */
    public function manage(): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->failForbidden();
        }

        $locale            = $this->request->getLocale();
        $achievementsModel = new AchievementsModel();
        $achievements      = $achievementsModel->orderBy('sort_order', 'ASC')->findAll();

        $result = [];

        foreach ($achievements as $achievement) {
            $rules = is_string($achievement->rules)
                ? json_decode($achievement->rules, true)
                : $achievement->rules;

            $result[] = (object) [
                'id'             => $achievement->id,
                'group_slug'     => $achievement->group_slug,
                'type'           => $achievement->type,
                'tier'           => $achievement->tier,
                'category'       => $achievement->category,
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
            ];
        }

        return $this->respond(['data' => $result]);
    }

    /**
     * POST /achievements
     * Admin only.
     *
     * @throws ReflectionException
     */
    public function create(): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->failForbidden();
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();

        if (empty($input)) {
            return $this->failValidationErrors(lang('Achievements.createError'));
        }

        $achievementsModel = new AchievementsModel();
        $entity            = new AchievementEntity();

        $entity->group_slug     = $input['group_slug']     ?? null;
        $entity->type           = $input['type']           ?? 'base';
        $entity->tier           = $input['tier']           ?? 'none';
        $entity->category       = $input['category']       ?? null;
        $entity->title_en       = $input['title_en']       ?? '';
        $entity->title_ru       = $input['title_ru']       ?? '';
        $entity->description_en = $input['description_en'] ?? null;
        $entity->description_ru = $input['description_ru'] ?? null;
        $entity->image          = $input['image']          ?? null;
        $entity->rules          = isset($input['rules']) ? json_encode($input['rules']) : '[]';
        $entity->season_start   = $input['season_start']   ?? null;
        $entity->season_end     = $input['season_end']     ?? null;
        $entity->xp_bonus       = (int) ($input['xp_bonus']  ?? 0);
        $entity->sort_order     = (int) ($input['sort_order'] ?? 0);
        $entity->is_active      = (int) ($input['is_active']  ?? 1);

        try {
            $achievementsModel->insert($entity);
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Achievements.createError'));
        }

        $created = $achievementsModel->find($achievementsModel->getLastGeneratedId());

        return $this->respondCreated($created);
    }

    /**
     * PUT /achievements/:id
     * Admin only.
     *
     * @throws ReflectionException
     */
    public function update($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->failForbidden();
        }

        if (!$id) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $achievementsModel = new AchievementsModel();
        $achievement       = $achievementsModel->find($id);

        if (!$achievement) {
            return $this->failNotFound(lang('Achievements.notFound'));
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();

        $updateData = [];

        $fields = [
            'group_slug', 'type', 'tier', 'category', 'title_en', 'title_ru',
            'description_en', 'description_ru', 'image', 'season_start',
            'season_end', 'xp_bonus', 'sort_order', 'is_active',
        ];

        foreach ($fields as $field) {
            if (array_key_exists($field, $input)) {
                $updateData[$field] = $input[$field];
            }
        }

        if (array_key_exists('rules', $input)) {
            $updateData['rules'] = is_array($input['rules'])
                ? json_encode($input['rules'])
                : $input['rules'];
        }

        try {
            $achievementsModel->update($id, $updateData);
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Achievements.updateError'));
        }

        $updated = $achievementsModel->find($id);

        // Decode rules for response
        if ($updated && is_string($updated->rules)) {
            $updated->rules = json_decode($updated->rules, true);
        }

        return $this->respond($updated);
    }

    /**
     * DELETE /achievements/:id
     * Admin only — soft delete (is_active = 0).
     * Hard deletes if no users have earned it.
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->failForbidden();
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
            }
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Achievements.deleteError'));
        }

        return $this->respondDeleted(['id' => $id]);
    }

    /**
     * POST /achievements/:id/image
     * Admin only — upload PNG/SVG badge image.
     */
    public function uploadImage($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->failForbidden();
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
            return $this->failValidationErrors('No valid image file provided.');
        }

        $allowedTypes = ['image/png', 'image/svg+xml'];
        if (!in_array($file->getMimeType(), $allowedTypes)) {
            return $this->failValidationErrors('Only PNG and SVG files are allowed.');
        }

        if ($file->getSize() > 1024 * 1024) {
            return $this->failValidationErrors('Image must be under 1 MB.');
        }

        $uploadPath = FCPATH . 'uploads/achievements/';

        if (!is_dir($uploadPath)) {
            mkdir($uploadPath, 0755, true);
        }

        $newName = $id . '_' . time() . '.' . $file->getExtension();

        if (!$file->move($uploadPath, $newName)) {
            return $this->failServerError('Failed to save the image.');
        }

        $imagePath = 'uploads/achievements/' . $newName;
        $achievementsModel->update($id, ['image' => $imagePath]);

        return $this->respond(['id' => $id, 'image' => $imagePath]);
    }
}
