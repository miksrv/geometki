<?php

namespace App\Models;

class UserInterestProfilesModel extends ApplicationBaseModel
{
    protected $table            = 'users_interest_profiles';
    protected $primaryKey       = 'id';
    protected $returnType       = 'object';
    protected $useAutoIncrement = true;
    protected $useSoftDeletes   = false;

    protected $allowedFields = [
        'user_id',
        'interest_type',
        'interest_value',
        'affinity',
        'ignored',
        'updated_at',
    ];

    protected $useTimestamps = false;

    protected $validationRules      = [];
    protected $validationMessages   = [];
    protected $skipValidation       = true;
    protected $cleanValidationRules = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = [];
    protected $afterInsert    = [];
    protected $beforeUpdate   = [];
    protected $afterUpdate    = [];
    protected $beforeFind     = [];
    protected $afterFind      = [];
    protected $beforeDelete   = [];
    protected $afterDelete    = [];

    /**
     * Signal weights for category interests.
     */
    private const CATEGORY_WEIGHTS = [
        'bookmarks' => 3.0,
        'visited'   => 2.0,
        'ratings'   => 2.5,
        'views'     => 1.0,
        'activity'  => 0.5,
    ];

    /**
     * Signal weights for tag interests (higher than categories - tags are more specific).
     */
    private const TAG_WEIGHTS = [
        'bookmarks' => 4.5,
        'visited'   => 3.0,
        'ratings'   => 3.5,
        'views'     => 1.5,
        'activity'  => 0.75,
    ];

    /**
     * Compute and persist affinity scores for a single user.
     * Calculates interests for both categories and tags.
     *
     * @param string $userId
     */
    public function refreshForUser(string $userId): void
    {
        $db            = \Config\Database::connect();
        $escapedUserId = $db->escape($userId);

        // Collect category interests
        $categoryTotals = $this->collectCategoryScores($db, $escapedUserId);

        // Collect tag interests
        $tagTotals = $this->collectTagScores($db, $escapedUserId);

        if (empty($categoryTotals) && empty($tagTotals)) {
            return;
        }

        $now = date('Y-m-d H:i:s');

        // Normalize and save category interests
        if (!empty($categoryTotals)) {
            $this->saveInterests($db, $escapedUserId, 'category', $categoryTotals, $now);
        }

        // Normalize and save tag interests
        if (!empty($tagTotals)) {
            $this->saveInterests($db, $escapedUserId, 'tag', $tagTotals, $now);
        }
    }

    /**
     * Collect raw scores for categories from all signal sources.
     *
     * @param \CodeIgniter\Database\BaseConnection $db
     * @param string $escapedUserId
     * @return array<string, float>
     */
    private function collectCategoryScores($db, string $escapedUserId): array
    {
        $w = self::CATEGORY_WEIGHTS;

        $queries = [
            // Bookmarks
            "SELECT p.category AS interest_key, COUNT(*) * {$w['bookmarks']} AS score
               FROM users_bookmarks ub
               JOIN places p ON p.id = ub.place_id AND p.deleted_at IS NULL
              WHERE ub.user_id = {$escapedUserId}
              GROUP BY p.category",

            // Visited
            "SELECT p.category AS interest_key, COUNT(*) * {$w['visited']} AS score
               FROM users_visited_places uv
               JOIN places p ON p.id = uv.place_id AND p.deleted_at IS NULL
              WHERE uv.user_id = {$escapedUserId}
              GROUP BY p.category",

            // Ratings >= 4
            "SELECT p.category AS interest_key, COUNT(*) * {$w['ratings']} AS score
               FROM rating r
               JOIN places p ON p.id = r.place_id AND p.deleted_at IS NULL
              WHERE r.user_id = {$escapedUserId}
                AND r.value >= 4
                AND r.deleted_at IS NULL
              GROUP BY p.category",

            // Page views
            "SELECT p.category AS interest_key, COUNT(*) * {$w['views']} AS score
               FROM users_place_views upv
               JOIN places p ON p.id = upv.place_id AND p.deleted_at IS NULL
              WHERE upv.user_id = {$escapedUserId}
              GROUP BY p.category",

            // Activity interactions
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
     * Collect raw scores for tags from all signal sources.
     *
     * @param \CodeIgniter\Database\BaseConnection $db
     * @param string $escapedUserId
     * @return array<string, float>
     */
    private function collectTagScores($db, string $escapedUserId): array
    {
        $w = self::TAG_WEIGHTS;

        $queries = [
            // Bookmarks by tags
            "SELECT t.id AS interest_key, COUNT(*) * {$w['bookmarks']} AS score
               FROM users_bookmarks ub
               JOIN places p ON p.id = ub.place_id AND p.deleted_at IS NULL
               JOIN places_tags pt ON pt.place_id = p.id AND pt.deleted_at IS NULL
               JOIN tags t ON t.id = pt.tag_id
              WHERE ub.user_id = {$escapedUserId}
              GROUP BY t.id",

            // Visited by tags
            "SELECT t.id AS interest_key, COUNT(*) * {$w['visited']} AS score
               FROM users_visited_places uv
               JOIN places p ON p.id = uv.place_id AND p.deleted_at IS NULL
               JOIN places_tags pt ON pt.place_id = p.id AND pt.deleted_at IS NULL
               JOIN tags t ON t.id = pt.tag_id
              WHERE uv.user_id = {$escapedUserId}
              GROUP BY t.id",

            // Ratings >= 4 by tags
            "SELECT t.id AS interest_key, COUNT(*) * {$w['ratings']} AS score
               FROM rating r
               JOIN places p ON p.id = r.place_id AND p.deleted_at IS NULL
               JOIN places_tags pt ON pt.place_id = p.id AND pt.deleted_at IS NULL
               JOIN tags t ON t.id = pt.tag_id
              WHERE r.user_id = {$escapedUserId}
                AND r.value >= 4
                AND r.deleted_at IS NULL
              GROUP BY t.id",

            // Page views by tags
            "SELECT t.id AS interest_key, COUNT(*) * {$w['views']} AS score
               FROM users_place_views upv
               JOIN places p ON p.id = upv.place_id AND p.deleted_at IS NULL
               JOIN places_tags pt ON pt.place_id = p.id AND pt.deleted_at IS NULL
               JOIN tags t ON t.id = pt.tag_id
              WHERE upv.user_id = {$escapedUserId}
              GROUP BY t.id",

            // Activity interactions by tags
            "SELECT t.id AS interest_key, COUNT(DISTINCT a.place_id) * {$w['activity']} AS score
               FROM activity a
               JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL
               JOIN places_tags pt ON pt.place_id = p.id AND pt.deleted_at IS NULL
               JOIN tags t ON t.id = pt.tag_id
              WHERE a.user_id = {$escapedUserId}
                AND a.deleted_at IS NULL
                AND a.place_id IS NOT NULL
              GROUP BY t.id",
        ];

        return $this->aggregateScores($db, $queries);
    }

    /**
     * Aggregate scores from multiple queries.
     *
     * @param \CodeIgniter\Database\BaseConnection $db
     * @param array $queries
     * @return array<string, float>
     */
    private function aggregateScores($db, array $queries): array
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
     * Normalize scores and save to database.
     *
     * @param \CodeIgniter\Database\BaseConnection $db
     * @param string $escapedUserId
     * @param string $interestType 'category' or 'tag'
     * @param array<string, float> $totals
     * @param string $now
     */
    private function saveInterests($db, string $escapedUserId, string $interestType, array $totals, string $now): void
    {
        $max = max($totals);
        if ($max <= 0) {
            return;
        }

        $escapedType = $db->escape($interestType);
        $escapedNow  = $db->escape($now);

        foreach ($totals as $value => $score) {
            $affinity      = round($score / $max, 6);
            $escapedValue  = $db->escape($value);
            $escapedAffinity = $db->escape($affinity);

            $db->query(
                "INSERT INTO users_interest_profiles (user_id, interest_type, interest_value, affinity, updated_at)
                 VALUES ({$escapedUserId}, {$escapedType}, {$escapedValue}, {$escapedAffinity}, {$escapedNow})
                 ON DUPLICATE KEY UPDATE affinity = {$escapedAffinity}, updated_at = {$escapedNow}"
            );
        }
    }

    /**
     * Get user interests by type (excluding ignored by default).
     *
     * @param string $userId
     * @param string $type 'category' or 'tag'
     * @param bool $includeIgnored Whether to include ignored interests
     * @return array
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
     * @param bool $includeIgnored Whether to include ignored interests
     * @return array{categories: array, tags: array}
     */
    public function getAllInterests(string $userId, bool $includeIgnored = false): array
    {
        $query = $this->where('user_id', $userId);

        if (!$includeIgnored) {
            $query->where('ignored', 0);
        }

        $interests = $query->orderBy('affinity', 'DESC')->findAll();

        $result = ['categories' => [], 'tags' => []];

        foreach ($interests as $interest) {
            if ($interest->interest_type === 'category') {
                $result['categories'][] = $interest;
            } else {
                $result['tags'][] = $interest;
            }
        }

        return $result;
    }

    /**
     * Ignore a specific interest for a user.
     *
     * @param string $userId
     * @param string $type 'category' or 'tag'
     * @param string $value The interest value (category slug or tag id)
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
     * Restore (un-ignore) a specific interest for a user.
     *
     * @param string $userId
     * @param string $type 'category' or 'tag'
     * @param string $value The interest value (category slug or tag id)
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
     * Get ignored interests for a user.
     *
     * @param string $userId
     * @return array{categories: array, tags: array}
     */
    public function getIgnoredInterests(string $userId): array
    {
        $interests = $this->where('user_id', $userId)
            ->where('ignored', 1)
            ->orderBy('affinity', 'DESC')
            ->findAll();

        $result = ['categories' => [], 'tags' => []];

        foreach ($interests as $interest) {
            if ($interest->interest_type === 'category') {
                $result['categories'][] = $interest;
            } else {
                $result['tags'][] = $interest;
            }
        }

        return $result;
    }
}
