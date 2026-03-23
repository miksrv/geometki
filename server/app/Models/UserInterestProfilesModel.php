<?php

namespace App\Models;

class UserInterestProfilesModel extends ApplicationBaseModel
{
    protected $table            = 'user_interest_profiles';
    protected $primaryKey       = 'id';
    protected $returnType       = 'object';
    protected $useAutoIncrement = true;
    protected $useSoftDeletes   = false;

    protected $allowedFields = [
        'user_id',
        'category',
        'affinity',
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
     * Compute and persist affinity scores for a single user.
     * Moves the five signal queries and REPLACE INTO upsert from
     * Commands/RefreshUserInterestProfiles.php::_refreshForUser().
     *
     * @param string $userId
     */
    public function refreshForUser(string $userId): void
    {
        $db            = \Config\Database::connect();
        $escapedUserId = $db->escape($userId);

        // Collect raw scores from each signal source.
        // Each query returns rows of (category, weighted_score).
        $queries = [
            // Bookmarks  — weight 3.0
            "SELECT p.category, COUNT(*) * 3.0 AS score
               FROM users_bookmarks ub
               JOIN places p ON p.id = ub.place_id AND p.deleted_at IS NULL
              WHERE ub.user_id = {$escapedUserId}
              GROUP BY p.category",

            // Visited    — weight 2.0
            "SELECT p.category, COUNT(*) * 2.0 AS score
               FROM users_visited_places uv
               JOIN places p ON p.id = uv.place_id AND p.deleted_at IS NULL
              WHERE uv.user_id = {$escapedUserId}
              GROUP BY p.category",

            // Ratings >= 4 — weight 2.5
            "SELECT p.category, COUNT(*) * 2.5 AS score
               FROM rating r
               JOIN places p ON p.id = r.place_id AND p.deleted_at IS NULL
              WHERE r.user_id = {$escapedUserId}
                AND r.value >= 4
                AND r.deleted_at IS NULL
              GROUP BY p.category",

            // Page views (from dedicated view tracking table) — weight 1.0
            "SELECT p.category, COUNT(*) * 1.0 AS score
               FROM user_place_views upv
               JOIN places p ON p.id = upv.place_id AND p.deleted_at IS NULL
              WHERE upv.user_id = {$escapedUserId}
              GROUP BY p.category",

            // Any activity interaction (edit, comment, photo, cover, rating) — weight 0.5
            "SELECT p.category, COUNT(DISTINCT a.place_id) * 0.5 AS score
               FROM activity a
               JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL
              WHERE a.user_id = {$escapedUserId}
                AND a.deleted_at IS NULL
                AND a.place_id IS NOT NULL
              GROUP BY p.category",
        ];

        // Sum scores across all signals.
        $totals = [];
        foreach ($queries as $sql) {
            $rows = $db->query($sql)->getResultArray();
            foreach ($rows as $row) {
                $cat            = $row['category'];
                $totals[$cat]   = ($totals[$cat] ?? 0.0) + (float) $row['score'];
            }
        }

        if (empty($totals)) {
            // No signal for this user — nothing to write.
            return;
        }

        // Normalize: divide every score by the maximum so top category = 1.0.
        $max = max($totals);
        if ($max <= 0) {
            return;
        }

        $now = date('Y-m-d H:i:s');

        foreach ($totals as $category => $score) {
            $affinity        = round($score / $max, 6);
            $escapedCategory = $db->escape($category);
            $escapedAffinity = $db->escape($affinity);
            $escapedNow      = $db->escape($now);

            $db->query(
                "REPLACE INTO user_interest_profiles (user_id, category, affinity, updated_at)
                 VALUES ({$escapedUserId}, {$escapedCategory}, {$escapedAffinity}, {$escapedNow})"
            );
        }
    }
}
