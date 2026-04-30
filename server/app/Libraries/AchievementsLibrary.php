<?php

namespace App\Libraries;

use App\Models\AchievementsModel;
use App\Models\UsersAchievementsModel;
use ReflectionException;

class AchievementsLibrary
{
    private const TIER_ORDER = ['none' => 0, 'bronze' => 1, 'silver' => 2, 'gold' => 3];

    private array $metricMap = [
        'place'   => ['places_created'],
        'edit'    => ['places_edited'],
        'photo'   => ['photos_uploaded'],
        'cover'   => ['photos_uploaded'],
        'rating'  => ['ratings_given'],
        'comment' => ['comments_written'],
    ];

    /**
     * Check achievements triggered by a specific activity type.
     * Includes tier-upgrade candidates (user may qualify for a higher tier in same group).
     *
     * @throws ReflectionException
     */
    public function check(string $userId, string $activityType): void
    {
        $relevantMetrics = $this->metricMap[$activityType] ?? null;

        $achievementsModel     = new AchievementsModel();
        $userAchievementsModel = new UsersAchievementsModel();

        // Map of group_slug => [achievement_id, tier] for already-earned achievements
        $earnedGroupMap = $this->getEarnedGroupMap($userId, $userAchievementsModel, $achievementsModel);

        $achievements = $achievementsModel->where('is_active', 1)->findAll();
        $now          = date('Y-m-d H:i:s');

        foreach ($achievements as $achievement) {
            // Skip if user already has this exact achievement
            if (isset($earnedGroupMap[$achievement->group_slug])) {
                $earnedTierOrder = self::TIER_ORDER[$earnedGroupMap[$achievement->group_slug]['tier']] ?? 0;
                $thisTierOrder   = self::TIER_ORDER[$achievement->tier] ?? 0;

                // Skip if user already has same or higher tier for this group
                if ($earnedTierOrder >= $thisTierOrder) {
                    continue;
                }
            }

            $rules = is_string($achievement->rules)
                ? json_decode($achievement->rules, true)
                : $achievement->rules;

            if (empty($rules)) {
                continue;
            }

            if ($relevantMetrics !== null) {
                $hasRelevantMetric = false;
                foreach ($rules as $rule) {
                    if (in_array($rule['metric'], $relevantMetrics, true)) {
                        $hasRelevantMetric = true;
                        break;
                    }
                }
                if (!$hasRelevantMetric) {
                    continue;
                }
            }

            if ($achievement->type === 'seasonal') {
                if ($achievement->season_start && $now < $achievement->season_start) {
                    continue;
                }
                if ($achievement->season_end && $now > $achievement->season_end) {
                    continue;
                }
            }

            $from = ($achievement->type === 'seasonal') ? $achievement->season_start : null;
            $to   = ($achievement->type === 'seasonal') ? $achievement->season_end   : null;

            if ($this->evaluateRules($userId, $rules, $from, $to)) {
                $progressSnapshot = [];
                foreach ($rules as $rule) {
                    $current = $this->resolveMetric($userId, $rule, $from, $to);
                    $progressSnapshot[$rule['metric']] = [
                        'current'  => $current,
                        'required' => $rule['value'],
                    ];
                }

                $this->awardAchievement($userId, $achievement, $progressSnapshot, $earnedGroupMap);
                $earnedGroupMap[$achievement->group_slug] = [
                    'achievement_id' => $achievement->id,
                    'tier'           => $achievement->tier,
                ];
            }
        }
    }

    /**
     * Full evaluation for one user. Returns newly earned achievement IDs.
     *
     * @return array
     * @throws ReflectionException
     */
    public function evaluate(string $userId): array
    {
        $achievementsModel     = new AchievementsModel();
        $userAchievementsModel = new UsersAchievementsModel();

        $earnedGroupMap = $this->getEarnedGroupMap($userId, $userAchievementsModel, $achievementsModel);

        $achievements = $achievementsModel->where('is_active', 1)->findAll();
        $awarded      = [];
        $now          = date('Y-m-d H:i:s');

        foreach ($achievements as $achievement) {
            if (isset($earnedGroupMap[$achievement->group_slug])) {
                $earnedTierOrder = self::TIER_ORDER[$earnedGroupMap[$achievement->group_slug]['tier']] ?? 0;
                $thisTierOrder   = self::TIER_ORDER[$achievement->tier] ?? 0;
                if ($earnedTierOrder >= $thisTierOrder) {
                    continue;
                }
            }

            $rules = is_string($achievement->rules)
                ? json_decode($achievement->rules, true)
                : $achievement->rules;

            if (empty($rules)) {
                continue;
            }

            if ($achievement->type === 'seasonal') {
                if ($achievement->season_start && $now < $achievement->season_start) {
                    continue;
                }
                if ($achievement->season_end && $now > $achievement->season_end) {
                    continue;
                }
            }

            $from = ($achievement->type === 'seasonal') ? $achievement->season_start : null;
            $to   = ($achievement->type === 'seasonal') ? $achievement->season_end   : null;

            if ($this->evaluateRules($userId, $rules, $from, $to)) {
                $progressSnapshot = [];
                foreach ($rules as $rule) {
                    $current = $this->resolveMetric($userId, $rule, $from, $to);
                    $progressSnapshot[$rule['metric']] = [
                        'current'  => $current,
                        'required' => $rule['value'],
                    ];
                }

                $this->awardAchievement($userId, $achievement, $progressSnapshot, $earnedGroupMap);
                $awarded[] = $achievement->id;
                $earnedGroupMap[$achievement->group_slug] = [
                    'achievement_id' => $achievement->id,
                    'tier'           => $achievement->tier,
                ];
            }
        }

        return $awarded;
    }

    /**
     * Return progress info for all active achievements for a user.
     *
     * @return array [achievementId => ['current' => int, 'required' => int, 'pct' => float]]
     */
    public function getProgress(string $userId): array
    {
        $achievementsModel     = new AchievementsModel();
        $userAchievementsModel = new UsersAchievementsModel();

        $now          = date('Y-m-d H:i:s');
        $achievements = $achievementsModel->where('is_active', 1)->findAll();

        $earned = $userAchievementsModel
            ->select('achievement_id, earned_at')
            ->where('user_id', $userId)
            ->findAll();

        $earnedMap = [];
        foreach ($earned as $e) {
            $earnedMap[$e->achievement_id] = $e->earned_at;
        }

        $result = [];

        foreach ($achievements as $achievement) {
            $rules = is_string($achievement->rules)
                ? json_decode($achievement->rules, true)
                : $achievement->rules;

            if (empty($rules)) {
                continue;
            }

            $from = ($achievement->type === 'seasonal') ? $achievement->season_start : null;
            $to   = ($achievement->type === 'seasonal') ? $achievement->season_end   : null;

            $current  = 0;
            $required = 0;

            foreach ($rules as $rule) {
                $threshold = (int) $rule['value'];
                $actual    = $this->resolveMetric($userId, $rule, $from, $to);

                $required += $threshold;
                $current  += min($actual, $threshold);
            }

            $pct = $required > 0 ? min(100.0, round(($current / $required) * 100, 1)) : 100.0;

            $result[$achievement->id] = [
                'current'  => $current,
                'required' => $required,
                'pct'      => $pct,
            ];
        }

        return $result;
    }

    private function evaluateRules(string $userId, array $rules, ?string $from, ?string $to): bool
    {
        foreach ($rules as $rule) {
            $current  = $this->resolveMetric($userId, $rule, $from, $to);
            $required = (int) $rule['value'];

            $passes = $current >= $required;

            if (!$passes) {
                return false;
            }
        }

        return true;
    }

    private function resolveMetric(string $userId, array $condition, ?string $from, ?string $to): int
    {
        $metric = $condition['metric'];
        $filter = $condition['filter'] ?? [];
        $db     = \Config\Database::connect();

        switch ($metric) {
            case 'places_created': {
                $builder = $db->table('activity')
                    ->selectCount('activity.id', 'cnt')
                    ->where('activity.type', 'place')
                    ->where('activity.user_id', $userId)
                    ->where('activity.deleted_at IS NULL');
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = activity.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('activity.created_at >=', $from);
                if ($to)   $builder->where('activity.created_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'places_edited': {
                $builder = $db->table('activity')
                    ->selectCount('activity.id', 'cnt')
                    ->where('activity.type', 'edit')
                    ->where('activity.user_id', $userId)
                    ->where('activity.deleted_at IS NULL');
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = activity.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('activity.created_at >=', $from);
                if ($to)   $builder->where('activity.created_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'places_visited': {
                $builder = $db->table('users_visited_places')
                    ->selectCount('users_visited_places.id', 'cnt')
                    ->where('users_visited_places.user_id', $userId);
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = users_visited_places.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'photos_uploaded': {
                $builder = $db->table('photos')
                    ->selectCount('photos.id', 'cnt')
                    ->where('photos.user_id', $userId)
                    ->where('photos.deleted_at IS NULL');
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = photos.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('photos.created_at >=', $from);
                if ($to)   $builder->where('photos.created_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'ratings_given': {
                $builder = $db->table('rating')
                    ->selectCount('rating.id', 'cnt')
                    ->where('rating.user_id', $userId)
                    ->where('rating.deleted_at IS NULL');
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = rating.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('rating.created_at >=', $from);
                if ($to)   $builder->where('rating.created_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'comments_written': {
                $builder = $db->table('comments')
                    ->selectCount('comments.id', 'cnt')
                    ->where('comments.user_id', $userId)
                    ->where('comments.deleted_at IS NULL');
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = comments.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('comments.created_at >=', $from);
                if ($to)   $builder->where('comments.created_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'bookmarks_added': {
                $builder = $db->table('users_bookmarks')
                    ->selectCount('users_bookmarks.id', 'cnt')
                    ->where('users_bookmarks.user_id', $userId);
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = users_bookmarks.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('users_bookmarks.created_at >=', $from);
                if ($to)   $builder->where('users_bookmarks.created_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'reputation_score': {
                $row = $db->table('users')->select('reputation')->where('id', $userId)->get()->getRow();
                return (int) ($row->reputation ?? 0);
            }

            case 'experience_total': {
                $row = $db->table('users')->select('experience')->where('id', $userId)->get()->getRow();
                return (int) ($row->experience ?? 0);
            }

            case 'level_reached': {
                $row = $db->table('users')->select('level')->where('id', $userId)->get()->getRow();
                return (int) ($row->level ?? 0);
            }

            case 'days_active': {
                $builder = $db->table('activity')
                    ->select('COUNT(DISTINCT DATE(created_at)) as cnt')
                    ->where('user_id', $userId)
                    ->where('deleted_at IS NULL');
                if ($from) $builder->where('created_at >=', $from);
                if ($to)   $builder->where('created_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'login_streak': {
                $rows = $db->query(
                    "SELECT DISTINCT DATE(sh.created_at) AS day
                     FROM sessions_history sh
                     INNER JOIN sessions s ON s.id = sh.session_id
                     WHERE s.user_id = ?
                     ORDER BY day ASC",
                    [$userId]
                )->getResultArray();

                if (empty($rows)) {
                    return 0;
                }

                $days          = array_column($rows, 'day');
                $maxStreak     = 1;
                $currentStreak = 1;

                for ($i = 1; $i < count($days); $i++) {
                    $prev = new \DateTime($days[$i - 1]);
                    $curr = new \DateTime($days[$i]);
                    $diff = (int) $prev->diff($curr)->days;

                    if ($diff === 1) {
                        $currentStreak++;
                        $maxStreak = max($maxStreak, $currentStreak);
                    } else {
                        $currentStreak = 1;
                    }
                }

                return $maxStreak;
            }

            default:
                return 0;
        }
    }

    /**
     * Award or upgrade an achievement for a user.
     * If the user already has a lower tier in the same group_slug, the record is upgraded.
     *
     * @throws ReflectionException
     */
    private function awardAchievement(
        string $userId,
        object $achievement,
        array  $progressSnapshot,
        array  $earnedGroupMap
    ): void {
        $userAchievementsModel = new UsersAchievementsModel();
        $isUpgrade             = isset($earnedGroupMap[$achievement->group_slug]);
        $earnedAt              = date('Y-m-d H:i:s');

        if ($isUpgrade) {
            $oldAchievementId = $earnedGroupMap[$achievement->group_slug]['achievement_id'];
            $existing         = $userAchievementsModel
                ->where('user_id', $userId)
                ->where('achievement_id', $oldAchievementId)
                ->first();

            if ($existing) {
                $userAchievementsModel->update($existing->id, [
                    'achievement_id' => $achievement->id,
                    'earned_at'      => $earnedAt,
                    'progress'       => json_encode($progressSnapshot),
                    'notified'       => 0,
                    'emailed'        => 0,
                ]);
            }
        } else {
            $entity                 = new \App\Entities\UserAchievementEntity();
            $entity->user_id        = $userId;
            $entity->achievement_id = $achievement->id;
            $entity->earned_at      = $earnedAt;
            $entity->progress       = $progressSnapshot;
            $entity->notified       = 0;
            $entity->emailed        = 0;

            $userAchievementsModel->insert($entity);
        }

        $xpDelta = $achievement->xp_bonus;
        if ($isUpgrade) {
            $oldAchievementId = $earnedGroupMap[$achievement->group_slug]['achievement_id'];
            $db               = \Config\Database::connect();
            $oldRow           = $db->table('achievements')
                ->select('xp_bonus')
                ->where('id', $oldAchievementId)
                ->get()->getRow();
            $xpDelta = max(0, $achievement->xp_bonus - (int) ($oldRow->xp_bonus ?? 0));
        }

        if ($xpDelta > 0) {
            $db = \Config\Database::connect();
            $db->query(
                'UPDATE users SET experience = experience + ? WHERE id = ?',
                [$xpDelta, $userId]
            );
        }

        $notify = new NotifyLibrary();
        $notify->push('achievements', $userId, null, [
            'title_en' => $achievement->title_en,
            'title_ru' => $achievement->title_ru,
            'image'    => $achievement->image,
        ]);
    }

    /**
     * Build a map of group_slug => ['achievement_id' => ..., 'tier' => ...] for earned achievements.
     */
    private function getEarnedGroupMap(
        string $userId,
        UsersAchievementsModel $userAchievementsModel,
        AchievementsModel $achievementsModel
    ): array {
        $earned = $userAchievementsModel
            ->select('achievement_id')
            ->where('user_id', $userId)
            ->findAll();

        if (empty($earned)) {
            return [];
        }

        $earnedIds = array_column($earned, 'achievement_id');

        $achievements = $achievementsModel
            ->select('id, group_slug, tier')
            ->whereIn('id', $earnedIds)
            ->findAll();

        $map = [];
        foreach ($achievements as $a) {
            $map[$a->group_slug] = [
                'achievement_id' => $a->id,
                'tier'           => $a->tier,
            ];
        }

        return $map;
    }
}
