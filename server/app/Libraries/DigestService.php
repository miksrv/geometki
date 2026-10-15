<?php

namespace App\Libraries;

use App\Libraries\Mail\MailUrls;
use App\Models\FeedModel;
use App\Models\PlacesModel;
use Config\Database;

class DigestService
{
    /**
     * Generate digest sections for a user covering the given week window.
     *
     * @param string $userId
     * @param string $weekStart  MySQL-formatted datetime, e.g. '2026-03-31 00:00:00'
     * @param string $weekEnd    MySQL-formatted datetime, e.g. '2026-04-07 23:59:59'
     * @param string|null $locale Locale of place titles (the recipient's); null means the request locale
     * @return array  Associative array of sections; only non-empty sections are included.
     */
    public function generateForUser(string $userId, string $weekStart, string $weekEnd, ?string $locale = null): array
    {
        $sections = [];

        $weekSummary = $this->buildWeekSummary($userId, $weekStart, $weekEnd);
        if ($weekSummary !== null) {
            $sections['week_summary'] = $weekSummary;
        }

        $placeActivity = $this->buildPlaceActivitySection($userId, $weekStart, $weekEnd, $locale);
        if ($placeActivity !== null) {
            $sections['place_activity'] = $placeActivity;
        }

        $sections['site'] = $this->buildSiteWeek($weekStart, $weekEnd, $locale ?? 'ru');

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

        return [
            'places_created'  => $placesCreated,
            'photos_uploaded' => $photosUploaded,
            'ratings_given'   => $ratingsGiven,
            'edits_made'      => $editsMade,
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
    public function buildPlaceActivitySection(string $userId, string $weekStart, string $weekEnd, ?string $locale = null): ?array
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
        $placeContent = (new PlacesContent())->forLocale($locale);
        $placeContent->translate($allPlaceIds);

        $placesModel = new PlacesModel();
        $placesData  = $placesModel
            ->select('id, slug, photos, cover_external_id')
            ->whereIn('id', $allPlaceIds)
            ->findAll();

        $coverMap = [];
        $slugMap   = [];
        $covers    = new PlaceFormatterLibrary();
        foreach ($placesData as $place) {
            $coverMap[$place->id] = $covers->coverExists(
                $place->id,
                (int) ($place->photos ?? 0) > 0 || !empty($place->cover_external_id)
            );
            $slugMap[$place->id]   = $place->slug;
        }

        $result = [];
        foreach ($allPlaceIds as $placeId) {
            $a = $activityMap[$placeId] ?? null;

            // Build cover URL if place has a cover: from its photos or a linked one
            $coverUrl = null;
            if ($coverMap[$placeId] ?? false) {
                $coverUrl = MailUrls::placeCover($placeId);
            }

            $result[] = [
                'place_id' => $placeId,
                'slug'     => $slugMap[$placeId] ?? null,
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

    /** Highlights in the digest, and at most this many of one person */
    public const HIGHLIGHTS       = 5;
    public const HIGHLIGHTS_EACH  = 2;

    /** Story types worth a line in the digest (the home page's weight >= 2 ones) */
    private const HIGHLIGHT_TYPES = ['place', 'photo', 'collection', 'comment', 'achievement', 'level'];

    /** The week of the site is the same for every recipient: built once per locale */
    private ?array $pulse = null;
    private array $highlights = [];

    /**
     * The week on the site, like the feed summary of the home page: event counts and
     * the most active people (FeedPulseLibrary), and the key stories of the feed.
     *
     * @return array{pulse: array, highlights: array<int, array>}
     */
    public function buildSiteWeek(string $weekStart, string $weekEnd, string $locale): array
    {
        $this->pulse ??= (new FeedPulseLibrary())->build($weekStart, $weekEnd);

        if (!isset($this->highlights[$locale])) {
            $stories = (new FeedPresenter($locale))->present(
                (new FeedModel())->getStories(['minWeight' => 2, 'since' => $weekStart, 'until' => $weekEnd], 40)
            );

            // Plain arrays, the shape GET /feed returns (the presenter mixes in row objects)
            $this->highlights[$locale] = self::pickHighlights(json_decode(json_encode($stories), true));
        }

        return ['pulse' => $this->pulse, 'highlights' => $this->highlights[$locale]];
    }

    /**
     * The stories for the digest: the most prominent first (a new place, photos, a
     * collection before a review or an achievement), newest first within a weight,
     * no more than HIGHLIGHTS_EACH of one person.
     *
     * @param array<int, array> $stories FeedPresenter stories, newest first
     *
     * @return array<int, array>
     */
    public static function pickHighlights(array $stories, int $limit = self::HIGHLIGHTS, int $perAuthor = self::HIGHLIGHTS_EACH): array
    {
        $stories = array_values(array_filter($stories, static fn (array $story) => in_array($story['type'], self::HIGHLIGHT_TYPES, true)));

        // usort is stable: the feed order stays within a weight
        usort($stories, static fn (array $a, array $b) => ($b['weight'] ?? 0) <=> ($a['weight'] ?? 0));

        $picked  = [];
        $byAuthor = [];

        foreach ($stories as $story) {
            $author = $story['author']['id'] ?? '';

            if (($byAuthor[$author] ?? 0) >= $perAuthor) {
                continue;
            }

            $byAuthor[$author] = ($byAuthor[$author] ?? 0) + 1;
            $picked[] = $story;

            if (count($picked) >= $limit) {
                break;
            }
        }

        return $picked;
    }
}
