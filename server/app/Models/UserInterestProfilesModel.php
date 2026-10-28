<?php

namespace App\Models;

use CodeIgniter\Database\BaseConnection;

/**
 * Model for the `users_interest_profiles` table.
 *
 * Computes, stores, and queries per-user affinity scores for both place
 * categories and place features (`places_now`, the `can_*` answers). Scores are normalised to [0, 1] and refreshed
 * asynchronously after user interactions.
 *
 * updated_at is in $allowedFields because it is managed manually via raw SQL
 * (ON DUPLICATE KEY UPDATE) rather than through the CI4 timestamp mechanism.
 * $useTimestamps is therefore false.
 *
 * @package App\Models
 */
class UserInterestProfilesModel extends ApplicationBaseModel
{
    protected $table            = 'users_interest_profiles';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'object';
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
        'interest_type',
        'interest_value',
        'affinity',
        'ignored',
        'updated_at',
    ];

    // updated_at is managed manually in saveInterests(); CI4 timestamps off.
    protected $useTimestamps = false;

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = false;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /**
     * Signal weights for category interest scoring.
     *
     * @var array<string, float>
     */
    private const CATEGORY_WEIGHTS = [
        'bookmarks' => 3.0,
        'visited'   => 2.0,
        'ratings'   => 2.5,
        'views'     => 1.0,
        'activity'  => 0.5,
    ];

    /**
     * Signal weights for feature interest scoring ("can swim", "can camp"…).
     * Features carry higher weight than categories as they are more specific.
     *
     * @var array<string, float>
     */
    private const FEATURE_WEIGHTS = [
        'bookmarks' => 4.5,
        'visited'   => 3.0,
        'ratings'   => 3.5,
        'views'     => 1.5,
        'activity'  => 0.75,
    ];

    // -------------------------------------------------------------------------
    // Public methods
    // -------------------------------------------------------------------------

    /**
     * Compute and persist affinity scores for a single user.
     * Calculates interests for both categories and features.
     *
     * @param string $userId
     * @return void
     */
    public function refreshForUser(string $userId): void
    {
        $db            = \Config\Database::connect();
        $escapedUserId = $db->escape($userId);

        $categoryTotals = $this->collectCategoryScores($db, $escapedUserId);
        $featureTotals  = $this->collectFeatureScores($db, $escapedUserId);

        if (empty($categoryTotals) && empty($featureTotals)) {
            return;
        }

        $now = date('Y-m-d H:i:s');

        if (!empty($categoryTotals)) {
            $this->saveInterests($db, $escapedUserId, 'category', $categoryTotals, $now);
        }

        if (!empty($featureTotals)) {
            $this->saveInterests($db, $escapedUserId, 'feature', $featureTotals, $now);
        }
    }

    /**
     * Get user interests by type, optionally including ignored ones.
     *
     * @param string $userId
     * @param string $type           'category' or 'feature'.
     * @param bool   $includeIgnored Whether to include ignored interests.
     * @return array<int, object>
     */
    public function getInterestsByType(string $userId, string $type, bool $includeIgnored = false): array
    {
        $query = $this->where('user_id', $userId)
            ->where('interest_type', $type);

        if (!$includeIgnored) {
            $query->where('ignored', 0);
        }

        return $query->orderBy('affinity', 'DESC')->findAll();
    }

    /**
     * Get all user interests grouped by type.
     *
     * @param string $userId
     * @param bool   $includeIgnored  Whether to include ignored interests.
     * @return array{categories: array<int, object>, features: array<int, object>}
     */
    public function getAllInterests(string $userId, bool $includeIgnored = false): array
    {
        $query = $this->where('user_id', $userId);

        if (!$includeIgnored) {
            $query->where('ignored', 0);
        }

        $interests = $query->orderBy('affinity', 'DESC')->findAll();

        $result = ['categories' => [], 'features' => []];

        foreach ($interests as $interest) {
            if ($interest->interest_type === 'category') {
                $result['categories'][] = $interest;
            } else {
                $result['features'][] = $interest;
            }
        }

        return $result;
    }

    /**
     * Mark a specific interest as ignored for a user.
     *
     * @param string $userId
     * @param string $type   'category' or 'feature'.
     * @param string $value  Category key or feature key.
     * @return bool
     */
    public function ignoreInterest(string $userId, string $type, string $value): bool
    {
        return $this->where('user_id', $userId)
            ->where('interest_type', $type)
            ->where('interest_value', $value)
            ->set('ignored', 1)
            ->update();
    }

    /**
     * Un-ignore (restore) a specific interest for a user.
     *
     * @param string $userId
     * @param string $type   'category' or 'feature'.
     * @param string $value  Category key or feature key.
     * @return bool
     */
    public function restoreInterest(string $userId, string $type, string $value): bool
    {
        return $this->where('user_id', $userId)
            ->where('interest_type', $type)
            ->where('interest_value', $value)
            ->set('ignored', 0)
            ->update();
    }

    /**
     * Get ignored interests for a user, grouped by type.
     *
     * @param string $userId
     * @return array{categories: array<int, object>, features: array<int, object>}
     */
    public function getIgnoredInterests(string $userId): array
    {
        $interests = $this->where('user_id', $userId)
            ->where('ignored', 1)
            ->orderBy('affinity', 'DESC')
            ->findAll();

        $result = ['categories' => [], 'features' => []];

        foreach ($interests as $interest) {
            if ($interest->interest_type === 'category') {
                $result['categories'][] = $interest;
            } else {
                $result['features'][] = $interest;
            }
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Collect raw weighted scores for categories from all signal sources.
     *
     * @param BaseConnection $db
     * @param string         $escapedUserId  Already-escaped user ID for interpolation.
     * @return array<string, float>
     */
    private function collectCategoryScores(BaseConnection $db, string $escapedUserId): array
    {
        $w = self::CATEGORY_WEIGHTS;

        $queries = [
            "SELECT p.category AS interest_key, COUNT(*) * {$w['bookmarks']} AS score
               FROM users_bookmarks ub
               JOIN places p ON p.id = ub.place_id AND p.deleted_at IS NULL
              WHERE ub.user_id = {$escapedUserId}
              GROUP BY p.category",

            "SELECT p.category AS interest_key, COUNT(*) * {$w['visited']} AS score
               FROM users_visited_places uv
               JOIN places p ON p.id = uv.place_id AND p.deleted_at IS NULL
              WHERE uv.user_id = {$escapedUserId}
              GROUP BY p.category",

            "SELECT p.category AS interest_key, COUNT(*) * {$w['ratings']} AS score
               FROM rating r
               JOIN places p ON p.id = r.place_id AND p.deleted_at IS NULL
              WHERE r.user_id = {$escapedUserId}
                AND r.value >= 4
                AND r.deleted_at IS NULL
              GROUP BY p.category",

            "SELECT p.category AS interest_key, COUNT(*) * {$w['views']} AS score
               FROM users_place_views upv
               JOIN places p ON p.id = upv.place_id AND p.deleted_at IS NULL
              WHERE upv.user_id = {$escapedUserId}
              GROUP BY p.category",

            "SELECT p.category AS interest_key, COUNT(DISTINCT a.place_id) * {$w['activity']} AS score
               FROM activity a
               JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL
              WHERE a.user_id = {$escapedUserId}
                AND a.deleted_at IS NULL
                AND a.place_id IS NOT NULL
              GROUP BY p.category",
        ];

        return $this->aggregateScores($db, $queries);
    }

    /**
     * Collect raw weighted scores for the features of places ("what can you do here", the
     * `can_*` rows of `places_now` with the value `yes`) from all signal sources: the places
     * a person keeps, visits, rates well and looks at. Their own answers are no signal.
     *
     * @param BaseConnection $db
     * @param string         $escapedUserId  Already-escaped user ID for interpolation.
     * @return array<string, float>
     */
    private function collectFeatureScores(BaseConnection $db, string $escapedUserId): array
    {
        $w      = self::FEATURE_WEIGHTS;
        $prefix = \Config\VisitQuestions::FEATURE_PREFIX;
        $key    = "SUBSTRING(pn.question, " . (strlen($prefix) + 1) . ") AS interest_key";
        $like   = str_replace('_', '\\_', $prefix) . '%';
        $join   = "JOIN places_now pn ON pn.place_id = p.id AND pn.question LIKE '{$like}' AND pn.value = 'yes'";

        $queries = [
            "SELECT {$key}, COUNT(*) * {$w['bookmarks']} AS score
               FROM users_bookmarks ub
               JOIN places p ON p.id = ub.place_id AND p.deleted_at IS NULL
               {$join}
              WHERE ub.user_id = {$escapedUserId}
              GROUP BY pn.question",

            "SELECT {$key}, COUNT(DISTINCT uv.place_id) * {$w['visited']} AS score
               FROM users_visited_places uv
               JOIN places p ON p.id = uv.place_id AND p.deleted_at IS NULL
               {$join}
              WHERE uv.user_id = {$escapedUserId}
              GROUP BY pn.question",

            "SELECT {$key}, COUNT(*) * {$w['ratings']} AS score
               FROM rating r
               JOIN places p ON p.id = r.place_id AND p.deleted_at IS NULL
               {$join}
              WHERE r.user_id = {$escapedUserId}
                AND r.value >= 4
                AND r.deleted_at IS NULL
              GROUP BY pn.question",

            "SELECT {$key}, COUNT(*) * {$w['views']} AS score
               FROM users_place_views upv
               JOIN places p ON p.id = upv.place_id AND p.deleted_at IS NULL
               {$join}
              WHERE upv.user_id = {$escapedUserId}
              GROUP BY pn.question",

            "SELECT {$key}, COUNT(DISTINCT a.place_id) * {$w['activity']} AS score
               FROM activity a
               JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL
               {$join}
              WHERE a.user_id = {$escapedUserId}
                AND a.deleted_at IS NULL
                AND a.place_id IS NOT NULL
              GROUP BY pn.question",
        ];

        return $this->aggregateScores($db, $queries);
    }

    /**
     * Execute a list of SQL queries and sum their scores by interest key.
     *
     * @param BaseConnection       $db
     * @param array<int, string>   $queries
     * @return array<string, float>
     */
    private function aggregateScores(BaseConnection $db, array $queries): array
    {
        $totals = [];

        foreach ($queries as $sql) {
            $rows = $db->query($sql)->getResultArray();
            foreach ($rows as $row) {
                $key          = $row['interest_key'];
                $totals[$key] = ($totals[$key] ?? 0.0) + (float) $row['score'];
            }
        }

        return $totals;
    }

    /**
     * Normalise scores to [0, 1] and upsert them into users_interest_profiles.
     *
     * @param BaseConnection       $db
     * @param string               $escapedUserId  Already-escaped user ID.
     * @param string               $interestType   'category' or 'feature'.
     * @param array<string, float> $totals         Raw score map.
     * @param string               $now            Formatted datetime string for updated_at.
     * @return void
     */
    private function saveInterests(
        BaseConnection $db,
        string $escapedUserId,
        string $interestType,
        array $totals,
        string $now
    ): void {
        $max = max($totals);
        if ($max <= 0) {
            return;
        }

        $escapedType = $db->escape($interestType);
        $escapedNow  = $db->escape($now);

        foreach ($totals as $value => $score) {
            $affinity        = round($score / $max, 6);
            $escapedValue    = $db->escape($value);
            $escapedAffinity = $db->escape($affinity);

            $db->query(
                "INSERT INTO users_interest_profiles (user_id, interest_type, interest_value, affinity, updated_at)
                 VALUES ({$escapedUserId}, {$escapedType}, {$escapedValue}, {$escapedAffinity}, {$escapedNow})
                 ON DUPLICATE KEY UPDATE affinity = {$escapedAffinity}, updated_at = {$escapedNow}"
            );
        }
    }
}
