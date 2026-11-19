<?php

namespace App\Libraries;

use App\Models\AchievementsModel;
use App\Models\UsersAchievementsModel;
use ReflectionException;

class AchievementsLibrary
{
    /** The metrics of the game: an award that counts one of them is an award of the game */
    public const GAME_METRICS = ['places_confirmed', 'quests_walked'];

    /**
     * Whether an award belongs to the game: it counts one of the game's metrics (a limited award
     * made for a season, a walked quest).
     */
    public static function isOfGame(object $achievement): bool
    {
        $rules = is_string($achievement->rules) ? json_decode($achievement->rules, true) : $achievement->rules;

        foreach ((array) $rules as $rule) {
            if (in_array($rule['metric'] ?? null, self::GAME_METRICS, true)) {
                return true;
            }
        }

        return false;
    }

    /** What an award can be: its kind and tier */
    public const TYPES      = ['base', 'seasonal'];
    public const TIERS      = ['none', 'bronze', 'silver', 'gold'];

    /** The metrics resolveMetric() counts: what a rule may name */
    public const METRICS = [
        'places_created', 'spots_opened', 'places_edited', 'places_visited', 'visits_total', 'winter_visits',
        'places_revisited', 'first_visit_of_year', 'places_confirmed', 'quests_walked', 'photos_uploaded',
        'ratings_given', 'comments_written', 'bookmarks_added', 'reputation_score', 'experience_total',
        'level_reached', 'days_active', 'login_streak',
    ];

    private const SMALLINT_MAX = 65535;

    private const TIER_ORDER = ['none' => 0, 'bronze' => 1, 'silver' => 2, 'gold' => 3];

    private array $metricMap = [
        'place'   => ['places_created', 'spots_opened'],
        'edit'    => ['places_edited'],
        'photo'   => ['photos_uploaded'],
        'cover'   => ['photos_uploaded'],
        'rating'  => ['ratings_given'],
        'comment' => ['comments_written'],
        // A check-in: the visit metrics only, not every achievement there is
        'visit'   => ['places_visited', 'visits_total', 'places_revisited', 'winter_visits', 'first_visit_of_year'],
        // A linked photo is not an uploaded one: it moves only the experience and the days
        'photo_link' => [],
        // The game: a confirmed visit, a walked quest (GameLibrary, QuestsLibrary)
        'game'    => self::GAME_METRICS,
    ];

    /**
     * Metrics any action can move (experience, level, active days, the streak) or that
     * others move between the user's actions (reputation): checked on every action, so
     * these achievements come without a scheduled `achievements:evaluate`.
     */
    private const ALWAYS_METRICS = ['experience_total', 'level_reached', 'reputation_score', 'days_active', 'login_streak'];

    /**
     * How long a user's progress is kept (getProgress()): a page of achievements is about
     * 60 counting queries. A change by the user's own action, a removal, a vote on their
     * places or an edit of the achievements drops it at once (forgetProgress(),
     * forgetAllProgress()); the time-bound metrics (the streak, active days, seasons) may lag
     * by this much.
     */
    private const PROGRESS_TTL = 600;

    private const PROGRESS_CACHE_PREFIX = 'achievements_progress_v2_';

    /** Drop the user's cached progress: their metrics have changed */
    public static function forgetProgress(string $userId): void
    {
        cache()->delete(self::PROGRESS_CACHE_PREFIX . $userId);
    }

    /** Drop everyone's cached progress: the achievements themselves have changed */
    public static function forgetAllProgress(): void
    {
        cache()->deleteMatching(self::PROGRESS_CACHE_PREFIX . '*');
    }

    /**
     * Check achievements triggered by a specific activity type.
     * Includes tier-upgrade candidates (user may qualify for a higher tier in same group).
     *
     * @throws ReflectionException
     */
    public function check(string $userId, string $activityType): void
    {
        // The action has moved the user's metrics; dropped again below, after the awards
        self::forgetProgress($userId);

        $relevantMetrics = isset($this->metricMap[$activityType])
            ? [...$this->metricMap[$activityType], ...self::ALWAYS_METRICS]
            : null;

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

        self::forgetProgress($userId);
    }

    /**
     * Full evaluation for one user. Returns newly earned achievement IDs.
     *
     * @param bool $notify false: award silently, without a notification (and its push / email)
     * @param bool $story  false: no story in the feed either (a quiet recount, achievements:rebuild)
     * @return array
     * @throws ReflectionException
     */
    public function evaluate(string $userId, bool $notify = true, bool $story = true): array
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

                $this->awardAchievement($userId, $achievement, $progressSnapshot, $earnedGroupMap, $notify, $story);
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
     * The metrics a person lowers by taking their own action back (a cancelled visit, a deleted
     * photo, place or review): an award counting only these is given back with the action.
     * The rest either move by themselves (reputation, experience, level) or count days — an
     * award earned by them stays earned.
     */
    private const REVOCABLE_METRICS = [
        'places_created', 'spots_opened', 'places_edited', 'places_visited', 'visits_total',
        'winter_visits', 'places_revisited', 'first_visit_of_year', 'places_confirmed',
        'quests_walked', 'photos_uploaded', 'ratings_given', 'comments_written',
    ];

    /**
     * After a person took an action back: the awards they hold whose terms are no longer met
     * go — down to the highest tier of the group still earned, or away. The award's story
     * leaves the feed with it; the experience follows on the next recount (it sums the awards
     * held: LevelsLibrary::experience()). Nothing is told: an award taken back is no news.
     *
     * @return string[] the IDs of the awards taken back
     */
    public function reconcile(string $userId): array
    {
        $db   = \Config\Database::connect();
        $held = $db->table('users_achievements ua')
            ->select('ua.id AS row_id, a.*')
            ->join('achievements a', 'a.id = ua.achievement_id')
            ->where('ua.user_id', $userId)
            ->get()->getResult();

        $revoked = [];

        foreach ($held as $achievement) {
            if (!$this->isRevocable($achievement) || $this->isMet($userId, $achievement)) {
                continue;
            }

            // The tiers of the group below this one, the highest first
            $tiers = $db->table('achievements')
                ->where(['group_slug' => $achievement->group_slug, 'is_active' => 1])
                ->get()->getResult();
            $order = self::TIER_ORDER[$achievement->tier] ?? 0;
            $tiers = array_filter($tiers, static fn ($tier) => (self::TIER_ORDER[$tier->tier] ?? 0) < $order);

            usort($tiers, static fn ($a, $b) => (self::TIER_ORDER[$b->tier] ?? 0) <=> (self::TIER_ORDER[$a->tier] ?? 0));

            $kept = null;
            $lost = [$achievement->id];

            foreach ($tiers as $tier) {
                if ($this->isMet($userId, $tier)) {
                    $kept = $tier;
                    break;
                }

                $lost[] = $tier->id;
            }

            if ($kept) {
                $db->table('users_achievements')->where('id', $achievement->row_id)->update(['achievement_id' => $kept->id]);
            } else {
                $db->table('users_achievements')->where('id', $achievement->row_id)->delete();
            }

            $db->table('feed')
                ->where(['user_id' => $userId, 'type' => 'achievement'])
                ->whereIn('achievement_id', $lost)
                ->delete();

            $revoked[] = $achievement->id;
        }

        if ($revoked) {
            self::forgetProgress($userId);
        }

        return $revoked;
    }

    /**
     * The awards a person holds that `reconcile()` would take back now: their terms are no
     * longer met (the titles, for `achievements:rebuild --dry-run`). Changes nothing.
     *
     * @return string[]
     */
    public function unmet(string $userId): array
    {
        $held = \Config\Database::connect()->table('users_achievements ua')
            ->select('a.*')
            ->join('achievements a', 'a.id = ua.achievement_id')
            ->where('ua.user_id', $userId)
            ->get()->getResult();

        $titles = [];

        foreach ($held as $achievement) {
            if ($this->isRevocable($achievement) && !$this->isMet($userId, $achievement)) {
                $titles[] = $achievement->title_ru . ' (' . $achievement->tier . ')';
            }
        }

        return $titles;
    }

    /** Whether an award counts only what its holder can take back themselves */
    private function isRevocable(object $achievement): bool
    {
        $rules = is_string($achievement->rules) ? json_decode($achievement->rules, true) : $achievement->rules;

        if (empty($rules)) {
            return false;
        }

        foreach ($rules as $rule) {
            if (!in_array($rule['metric'] ?? null, self::REVOCABLE_METRICS, true)) {
                return false;
            }
        }

        return true;
    }

    /** Whether the terms of an award are met now (a limited one — within its window) */
    private function isMet(string $userId, object $achievement): bool
    {
        $rules = is_string($achievement->rules) ? json_decode($achievement->rules, true) : $achievement->rules;

        if (empty($rules)) {
            return false;
        }

        $seasonal = $achievement->type === 'seasonal';

        return $this->evaluateRules(
            $userId,
            $rules,
            $seasonal ? $achievement->season_start : null,
            $seasonal ? $achievement->season_end : null
        );
    }

    /**
     * Return progress info for all active achievements for a user (cached, PROGRESS_TTL).
     *
     * `current` / `required` sum the rules (each capped at its threshold) for one bar; `rules` keeps
     * each rule apart — an achievement of two rules is not read from their sum
     *
     * @return array [achievementId => ['current' => int, 'required' => int, 'pct' => float,
     *               'rules' => list<array{metric: string, current: int, required: int}>]]
     */
    public function getProgress(string $userId): array
    {
        $key    = self::PROGRESS_CACHE_PREFIX . $userId;
        $cached = cache($key);

        if (is_array($cached)) {
            return $cached;
        }

        $progress = $this->countProgress($userId);

        cache()->save($key, $progress, self::PROGRESS_TTL);

        return $progress;
    }

    private function countProgress(string $userId): array
    {
        return $this->progressOf($userId, (new AchievementsModel())->where('is_active', 1)->findAll());
    }

    /**
     * The progress of a person with some achievements, counted now (no cache): each rule's metric
     * is read anew — the costly part, asked for one achievement's card at a time
     * (`GET /users/:id/achievements/:group`) or for all of them by `getProgress()`.
     *
     * `current` / `required` sum the rules (each capped at its threshold) for one bar; `rules` keeps
     * each rule apart — an achievement of two rules is not read from their sum
     *
     * @param list<object> $achievements
     *
     * @return array [achievementId => ['current' => int, 'required' => int, 'pct' => float,
     *               'rules' => list<array{metric: string, current: int, required: int}>]]
     */
    public function progressOf(string $userId, array $achievements): array
    {
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
            $parts    = [];

            foreach ($rules as $rule) {
                $threshold = (int) $rule['value'];
                $actual    = $this->resolveMetric($userId, $rule, $from, $to);

                $required += $threshold;
                $current  += min($actual, $threshold);
                $parts[]   = ['metric' => (string) $rule['metric'], 'current' => (int) $actual, 'required' => $threshold];
            }

            $pct = $required > 0 ? min(100.0, round(($current / $required) * 100, 1)) : 100.0;

            $result[$achievement->id] = [
                'current'  => $current,
                'required' => $required,
                'pct'      => $pct,
                'rules'    => $parts,
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

            case 'spots_opened': {
                // White spots: places created from an OSM candidate; no period filter
                return (new \App\Models\OsmCandidatesModel())->spotsOpened($userId);
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

            // Visits are a log: the distinct places, all the check-ins,
            // the places seen in 2+ calendar years, the winter check-ins, the check-ins that
            // opened a place's year. The season window applies to the visit day.
            case 'places_visited':
            case 'visits_total':
            case 'winter_visits': {
                $builder = $db->table('users_visited_places')
                    ->select($metric === 'places_visited' ? 'COUNT(DISTINCT users_visited_places.place_id) AS cnt' : 'COUNT(*) AS cnt', false)
                    ->where('users_visited_places.user_id', $userId);
                if ($metric === 'winter_visits') {
                    $builder->where('MONTH(users_visited_places.visited_at) IN (12, 1, 2)', null, false);
                }
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = users_visited_places.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('users_visited_places.visited_at >=', $from);
                if ($to)   $builder->where('users_visited_places.visited_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            case 'places_revisited': {
                $row = $db->query(
                    'SELECT COUNT(*) AS cnt FROM (
                        SELECT place_id FROM users_visited_places WHERE user_id = ?
                         GROUP BY place_id HAVING COUNT(DISTINCT YEAR(visited_at)) >= 2
                    ) revisited',
                    [$userId]
                )->getRow();
                return (int) ($row->cnt ?? 0);
            }

            case 'first_visit_of_year': {
                $row = $db->query(
                    'SELECT COUNT(*) AS cnt FROM users_visited_places v
                      WHERE v.user_id = ?
                        AND NOT EXISTS (
                            SELECT 1 FROM users_visited_places o
                             WHERE o.place_id = v.place_id AND o.id != v.id
                               AND YEAR(o.visited_at) = YEAR(v.visited_at)
                               AND (o.visited_at < v.visited_at OR (o.visited_at = v.visited_at AND o.created_at < v.created_at))
                        )',
                    [$userId]
                )->getRow();
                return (int) ($row->cnt ?? 0);
            }

            // The game. Confirmed places: the distinct places with a confirmed visit (a photo
            // shot there or "I am here"), all time or within the window by the visit day
            case 'places_confirmed': {
                $builder = $db->table('users_visited_places')
                    ->select('COUNT(DISTINCT users_visited_places.place_id) AS cnt', false)
                    ->where('users_visited_places.user_id', $userId)
                    ->where('users_visited_places.confirmed IS NOT NULL', null, false);
                if (!empty($filter['category_id'])) {
                    $builder->join('places', 'places.id = users_visited_places.place_id', 'inner')
                            ->where('places.category', $filter['category_id']);
                }
                if ($from) $builder->where('users_visited_places.visited_at >=', $from);
                if ($to)   $builder->where('users_visited_places.visited_at <=', $to);
                return (int) ($builder->get()->getRow()->cnt ?? 0);
            }

            // Quests walked to the end; `filter.quest_id` asks for one quest (its own award)
            case 'quests_walked': {
                $builder = $db->table('quests_walks')
                    ->selectCount('quests_walks.id', 'cnt')
                    ->where('quests_walks.user_id', $userId)
                    ->where('quests_walks.finished_at IS NOT NULL', null, false);
                if (!empty($filter['quest_id'])) {
                    $builder->where('quests_walks.quest_id', $filter['quest_id']);
                }
                if ($from) $builder->where('quests_walks.finished_at >=', $from);
                if ($to)   $builder->where('quests_walks.finished_at <=', $to);
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
                // Days with activity, counted like the profile's contribution calendar
                // (Feed::calendar()): in the site's time zone, bookmarks left out
                $offset = (new \DateTimeZone(SITE_TIMEZONE))->getOffset(new \DateTimeImmutable('now'));
                $rows   = $db->table('activity')
                    ->select('DISTINCT DATE(created_at + INTERVAL ' . $offset . ' SECOND) AS day', false)
                    ->where('user_id', $userId)
                    ->where('deleted_at', null)
                    ->where('type !=', 'bookmark')
                    ->orderBy('day', 'ASC')
                    ->get()
                    ->getResultArray();

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
        array  $earnedGroupMap,
        bool   $notify = true,
        bool   $story = true
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

        if ($story) {
            try {
                (new FeedLibrary())->achievement($userId, $achievement->id);
            } catch (\Throwable $e) {
                log_message('error', '{exception}', ['exception' => $e]);
            }
        }

        if (!$notify) {
            return;
        }

        (new NotifyLibrary())->push('achievements', $userId, null, [
            'title_en' => $achievement->title_en,
            'title_ru' => $achievement->title_ru,
            'image'    => $achievement->image,
            // An award without a picture is drawn from these (the client's AwardBadge)
            'tier'     => $achievement->tier,
            'group'    => $achievement->group_slug,
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

    /**
     * What the administrator sent for an award, checked: the clean fields to save, or the
     * errors by field. A partial update (`$existing`) checks only what was sent.
     *
     * @param array<string, mixed>       $input
     * @param array<string, mixed>|null  $existing the award being edited (its `type`, `season_start`, `season_end`), null for a new one
     * @return array{0: array<string, mixed>, 1: array<string, string>} fields, errors
     */
    public static function validateAchievement(array $input, ?array $existing = null): array
    {
        $fields = [];
        $errors = [];
        $new    = $existing === null;
        $has    = static fn (string $key): bool => array_key_exists($key, $input);

        if ($new || $has('group_slug')) {
            $slug = $input['group_slug'] ?? null;

            if (!is_string($slug) || !preg_match('/^[A-Za-z0-9_-]{1,50}$/D', $slug)) {
                $errors['group_slug'] = lang('Achievements.slugRequired');
            } else {
                $fields['group_slug'] = $slug;
            }
        }

        foreach (['type' => [self::TYPES, 'base'], 'tier' => [self::TIERS, 'none']] as $key => [$allowed, $default]) {
            if ($has($key) || $new) {
                $value = $input[$key] ?? $default;

                if (!is_string($value) || !in_array($value, $allowed, true)) {
                    $errors[$key] = lang('Achievements.badEnum', [implode(', ', $allowed)]);
                } else {
                    $fields[$key] = $value;
                }
            }
        }

        if ($new || $has('title_ru')) {
            $title = is_string($input['title_ru'] ?? null) ? trim($input['title_ru']) : '';

            if ($title === '') {
                $errors['title_ru'] = lang('Achievements.titleRequired');
            } elseif (mb_strlen($title) > 150) {
                $errors['title_ru'] = lang('Achievements.textLong', [150]);
            } else {
                $fields['title_ru'] = $title;
            }
        }

        // The English texts and the descriptions: a string, or null to clear; the title is never null in the table
        foreach (['title_en' => 150, 'description_ru' => 5000, 'description_en' => 5000] as $key => $max) {
            if (!$has($key)) {
                continue;
            }

            if ($input[$key] !== null && !is_string($input[$key])) {
                $errors[$key] = lang('Achievements.notString');
            } elseif (mb_strlen(trim((string) $input[$key])) > $max) {
                $errors[$key] = lang('Achievements.textLong', [$max]);
            } else {
                $text = trim((string) $input[$key]);

                $fields[$key] = $key === 'title_en' ? $text : ($text !== '' ? $text : null);
            }
        }

        if ($has('image')) {
            if ($input['image'] !== null && !AdminImageLibrary::isOwnPath(is_string($input['image']) ? $input['image'] : null, 'achievements')) {
                $errors['image'] = lang('Achievements.badImagePath');
            } else {
                $fields['image'] = $input['image'];
            }
        }

        foreach (['xp_bonus', 'sort_order'] as $key) {
            if ($has($key)) {
                $value = $input[$key];

                if (is_string($value) && preg_match('/^\d{1,5}$/', $value)) {
                    $value = (int) $value;
                }

                if (!is_int($value) || $value < 0 || $value > self::SMALLINT_MAX) {
                    $errors[$key] = lang('Achievements.badInt', [self::SMALLINT_MAX]);
                } else {
                    $fields[$key] = $value;
                }
            }
        }

        if ($has('is_active')) {
            $flag = $input['is_active'];

            if (!in_array($flag, [true, false, 0, 1, '0', '1'], true)) {
                $errors['is_active'] = lang('Achievements.badBool');
            } else {
                $fields['is_active'] = (int) $flag;
            }
        }

        if ($has('rules')) {
            $rules = self::cleanRules($input['rules']);

            if ($rules === null) {
                $errors['rules'] = lang('Achievements.badRules');
            } else {
                $fields['rules'] = $rules;
            }
        }

        // The window of a limited award: dates (a bare end day lasts to its last second)
        foreach (['season_start' => '00:00:00', 'season_end' => '23:59:59'] as $key => $time) {
            if (!$has($key)) {
                continue;
            }

            $value = $input[$key];

            if ($value === null || $value === '') {
                $fields[$key] = null;
            } elseif (is_string($value) && self::isDate($value, 'Y-m-d')) {
                $fields[$key] = $value . ' ' . $time;
            } elseif (is_string($value) && self::isDate($value, 'Y-m-d H:i:s')) {
                $fields[$key] = $value;
            } else {
                $errors[$key] = lang('Achievements.badDate');
            }
        }

        $type  = $fields['type'] ?? ($existing['type'] ?? 'base');
        $start = array_key_exists('season_start', $fields) ? $fields['season_start'] : ($existing['season_start'] ?? null);
        $end   = array_key_exists('season_end', $fields) ? $fields['season_end'] : ($existing['season_end'] ?? null);

        if ($type === 'seasonal' && !isset($errors['season_start']) && !isset($errors['season_end']) && !isset($errors['type'])) {
            if (!$start || !$end || (string) $start > (string) $end) {
                $errors['season_start'] = lang('Achievements.seasonDates');
            }
        }

        return [$fields, $errors];
    }

    /**
     * The rules as they are stored: `{ metric, operator, value, filter? }` of known metrics.
     * Null when it is not a list of such rules.
     *
     * @return array<int, array<string, mixed>>|null
     */
    private static function cleanRules(mixed $rules): ?array
    {
        if (!is_array($rules) || !array_is_list($rules) || count($rules) > 20) {
            return null;
        }

        $clean = [];

        foreach ($rules as $rule) {
            if (
                !is_array($rule)
                || !is_string($rule['metric'] ?? null) || !in_array($rule['metric'], self::METRICS, true)
                || !isset($rule['value']) || !is_numeric($rule['value']) || is_bool($rule['value']) || $rule['value'] < 0
                || (isset($rule['operator']) && $rule['operator'] !== '>=')
            ) {
                return null;
            }

            $item = ['metric' => $rule['metric'], 'operator' => '>=', 'value' => $rule['value'] + 0];

            if (isset($rule['filter'])) {
                if (!is_array($rule['filter'])) {
                    return null;
                }

                // The filters the metrics read (resolveMetric): a category of places, one quest
                foreach (['category_id', 'quest_id'] as $key) {
                    $value = $rule['filter'][$key] ?? null;

                    if ($value !== null && !is_string($value) && !is_int($value)) {
                        return null;
                    }

                    if ($value !== null && $value !== '') {
                        $item['filter'][$key] = (string) $value;
                    }
                }
            }

            $clean[] = $item;
        }

        return $clean;
    }

    private static function isDate(string $value, string $format): bool
    {
        $date = \DateTime::createFromFormat('!' . $format, $value);

        return $date !== false && $date->format($format) === $value;
    }
}
