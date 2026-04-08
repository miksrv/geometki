<?php

namespace App\Libraries;

use App\Models\ActivityModel;
use App\Models\PlacesModel;
use App\Models\UsersModel;
use Config\Database;

class DigestService
{
    private ActivityModel $activityModel;
    private UsersModel    $usersModel;

    public function __construct()
    {
        $this->activityModel = new ActivityModel();
        $this->usersModel    = new UsersModel();
    }

    /**
     * Generate digest sections for a user covering the given week window.
     *
     * @param string $userId
     * @param string $weekStart  MySQL-formatted datetime, e.g. '2026-03-31 00:00:00'
     * @param string $weekEnd    MySQL-formatted datetime, e.g. '2026-04-07 23:59:59'
     * @return array  Associative array of sections; only non-empty sections are included.
     */
    public function generateForUser(string $userId, string $weekStart, string $weekEnd): array
    {
        $sections = [];

        $weekSummary = $this->buildWeekSummary($userId, $weekStart, $weekEnd);
        if ($weekSummary !== null) {
            $sections['week_summary'] = $weekSummary;
        }

        $placeActivity = $this->buildPlaceActivitySection($userId, $weekStart, $weekEnd);
        if ($placeActivity !== null) {
            $sections['place_activity'] = $placeActivity;
        }

        $sections['community'] = $this->buildCommunityHighlights($weekStart, $weekEnd);

        return $sections;
    }

    /**
     * Summarise the user's own activity during the week.
     * Returns null if the user had zero activity (nothing to report).
     *
     * @param string $userId
     * @param string $weekStart
     * @param string $weekEnd
     * @return array|null
     */
    public function buildWeekSummary(string $userId, string $weekStart, string $weekEnd): ?array
    {
        $db = Database::connect();

        $rows = $db->query(
            "SELECT
                SUM(type = 'place')                  AS places_created,
                SUM(type = 'photo')                  AS photos_uploaded,
                SUM(type = 'rating')                 AS ratings_given,
                SUM(type IN ('edit', 'cover'))        AS edits_made
             FROM activity
             WHERE user_id = ?
               AND created_at BETWEEN ? AND ?
               AND deleted_at IS NULL",
            [$userId, $weekStart, $weekEnd]
        )->getRow();

        $placesCreated  = (int) ($rows->places_created  ?? 0);
        $photosUploaded = (int) ($rows->photos_uploaded ?? 0);
        $ratingsGiven   = (int) ($rows->ratings_given   ?? 0);
        $editsMade      = (int) ($rows->edits_made      ?? 0);

        if (($placesCreated + $photosUploaded + $ratingsGiven + $editsMade) === 0) {
            return null;
        }

        // Check whether the user has been inactive for 14+ days
        $user       = $this->usersModel->select('activity_at')->find($userId);
        $isInactive = false;

        if ($user && $user->activity_at) {
            $activityAt = $user->activity_at instanceof \CodeIgniter\I18n\Time
                ? $user->activity_at->getTimestamp()
                : strtotime((string) $user->activity_at);

            $isInactive = $activityAt <= strtotime('-14 days');
        }

        return [
            'places_created'  => $placesCreated,
            'photos_uploaded' => $photosUploaded,
            'ratings_given'   => $ratingsGiven,
            'edits_made'      => $editsMade,
            'is_inactive'     => $isInactive,
        ];
    }

    /**
     * Build a section describing activity by OTHER users on places owned by this user.
     * Returns null when there were no such events during the week.
     *
     * @param string $userId
     * @param string $weekStart
     * @param string $weekEnd
     * @return array|null
     */
    public function buildPlaceActivitySection(string $userId, string $weekStart, string $weekEnd): ?array
    {
        $db = Database::connect();

        // Step 1: Activity by other users on places owned by this user.
        // JOIN eliminates the need to first fetch place IDs separately.
        $activityRows = $db->query("
            SELECT
                a.place_id,
                SUM(a.type = 'rating')  AS ratings,
                SUM(a.type = 'comment') AS comments,
                SUM(a.type = 'photo')   AS photos,
                SUM(a.type = 'edit')    AS edits
            FROM activity a
            JOIN places p ON p.id = a.place_id
                AND p.user_id = ?
                AND p.deleted_at IS NULL
            WHERE a.created_at BETWEEN ? AND ?
              AND a.type IN ('rating', 'comment', 'photo', 'edit')
              AND a.user_id != ?
              AND a.deleted_at IS NULL
            GROUP BY a.place_id
            HAVING (ratings + comments + photos + edits) > 0
        ", [$userId, $weekStart, $weekEnd, $userId])->getResultArray();

        // Step 2: Views from places_views_log for the period.
        // Wrapped in try/catch so the method degrades gracefully if the table
        // does not yet exist in the target database.
        $viewsRows = [];
        try {
            $viewsRows = $db->query("
                SELECT pvl.place_id, SUM(pvl.count) AS views
                FROM places_views_log pvl
                JOIN places p ON p.id = pvl.place_id
                    AND p.user_id = ?
                    AND p.deleted_at IS NULL
                WHERE pvl.view_date BETWEEN DATE(?) AND DATE(?)
                GROUP BY pvl.place_id
            ", [$userId, $weekStart, $weekEnd])->getResultArray();
        } catch (\Throwable $e) {
            // Table may not exist yet; proceed without view counts.
            $viewsRows = [];
        }

        if (empty($activityRows) && empty($viewsRows)) {
            return null;
        }

        // Step 3: Merge data by place_id from both sources.
        $viewsMap = [];
        foreach ($viewsRows as $row) {
            $viewsMap[$row['place_id']] = (int) $row['views'];
        }

        $activityMap = [];
        foreach ($activityRows as $row) {
            $activityMap[$row['place_id']] = $row;
        }

        $allPlaceIds = array_unique(array_merge(
            array_keys($activityMap),
            array_keys($viewsMap)
        ));

        // Step 4: Fetch place titles and check for cover images
        $placeContent = new PlacesContent();
        $placeContent->translate($allPlaceIds);

        $placesModel = new PlacesModel();
        $placesData  = $placesModel
            ->select('id, photos')
            ->whereIn('id', $allPlaceIds)
            ->findAll();

        $photosMap = [];
        foreach ($placesData as $place) {
            $photosMap[$place->id] = (int) ($place->photos ?? 0);
        }

        $result = [];
        foreach ($allPlaceIds as $placeId) {
            $a = $activityMap[$placeId] ?? null;

            // Build cover URL if place has photos
            $coverUrl = null;
            if (($photosMap[$placeId] ?? 0) > 0) {
                $coverUrl = 'https://api.geometki.com/' . PATH_PHOTOS . $placeId . '/cover.jpg';
            }

            $result[] = [
                'place_id' => $placeId,
                'title'    => $placeContent->title($placeId) ?: "Place #{$placeId}",
                'cover'    => $coverUrl,
                'ratings'  => (int) ($a['ratings']  ?? 0),
                'comments' => (int) ($a['comments'] ?? 0),
                'photos'   => (int) ($a['photos']   ?? 0),
                'edits'    => (int) ($a['edits']    ?? 0),
                'views'    => $viewsMap[$placeId] ?? 0,
            ];
        }

        // Step 5: Sort by engagement score, keep top 10.
        usort($result, function (array $a, array $b): int {
            $scoreA = $a['ratings'] * 5 + $a['comments'] * 4 + $a['photos'] * 3 + $a['edits'] * 2 + min($a['views'], 50);
            $scoreB = $b['ratings'] * 5 + $b['comments'] * 4 + $b['photos'] * 3 + $b['edits'] * 2 + min($b['views'], 50);
            return $scoreB <=> $scoreA;
        });

        return array_slice($result, 0, 10);
    }

    /**
     * Build platform-wide highlights for the week.
     * Always returns an array (may have zeroed-out counters).
     *
     * @param string $weekStart
     * @param string $weekEnd
     * @return array
     */
    public function buildCommunityHighlights(string $weekStart, string $weekEnd): array
    {
        $db = Database::connect();

        // Count new places added during the week
        $newPlacesRow = $db->query(
            "SELECT COUNT(*) AS cnt
             FROM activity
             WHERE type = 'place'
               AND created_at BETWEEN ? AND ?
               AND deleted_at IS NULL",
            [$weekStart, $weekEnd]
        )->getRow();

        $newPlacesCount = (int) ($newPlacesRow->cnt ?? 0);

        // Find the user with most activity events during the week
        $topUserRow = $db->query(
            "SELECT a.user_id, COUNT(*) AS cnt
             FROM activity a
             WHERE a.created_at BETWEEN ? AND ?
               AND a.user_id IS NOT NULL
               AND a.deleted_at IS NULL
             GROUP BY a.user_id
             ORDER BY cnt DESC
             LIMIT 1",
            [$weekStart, $weekEnd]
        )->getRow();

        $topUser = null;
        if ($topUserRow && $topUserRow->user_id) {
            $userRecord = $this->usersModel
                ->select('id, name, level')
                ->find($topUserRow->user_id);

            if ($userRecord) {
                $topUser = [
                    'id'             => $userRecord->id,
                    'name'           => $userRecord->name,
                    'level'          => $userRecord->level,
                    'activity_count' => (int) $topUserRow->cnt,
                ];
            }
        }

        return [
            'new_places_count' => $newPlacesCount,
            'top_user'         => $topUser,
        ];
    }
}
