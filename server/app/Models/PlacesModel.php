<?php

namespace App\Models;

class PlacesModel extends ApplicationBaseModel {
    protected $table            = 'places';
    protected $primaryKey       = 'id';
    protected $returnType       = \App\Entities\PlaceEntity::class;
    protected $useAutoIncrement = false;
    protected $useSoftDeletes   = true;

    protected array $hiddenFields = ['deleted_at'];

    protected $allowedFields = [
        'category',
        'lat',
        'lon',
        'rating',
        'views',
        'trending_score',
        'photos',
        'comments',
        'bookmarks',
        'address_en',
        'address_ru',
        'country_id',
        'region_id',
        'district_id',
        'locality_id',
        'user_id',
        'updated_at',
        'created_at'
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules = [
        'category'    => 'required|string|max_length[50]',
        'lat'         => 'decimal',
        'lon'         => 'decimal',
        'rating'      => 'integer|max_length[1]|greater_than[0]',
        'views'       => 'integer|max_length[10]|greater_than[0]',
        'photos'      => 'integer|max_length[5]',
        'address_en'  => 'string|max_length[250]',
        'address_ru'  => 'string|max_length[250]',
        'country_id'  => 'integer|max_length[5]',
        'region_id'   => 'integer|max_length[5]',
        'district_id' => 'integer|max_length[5]',
        'locality_id' => 'integer|max_length[5]',
        'user_id'     => 'required|string|min_length[3]|max_length[40]',
    ];

    protected $validationMessages   = [];
    protected $skipValidation       = true;
    protected $cleanValidationRules = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
    protected $afterInsert    = [];
    protected $beforeUpdate   = [];
    protected $afterUpdate    = [];
    protected $beforeFind     = [];
    protected $afterFind      = ['prepareOutput'];
    protected $beforeDelete   = [];
    protected $afterDelete    = [];

    /**
     * @param string $category
     * @return int|string
     */
    public function getCountPlacesByCategory(string $category): int|string
    {
        return $this
            ->select('id')
            ->where('category', $category)
            ->countAllResults();
    }

    /**
     * @param float|null $lat
     * @param float|null $lon
     * @return string
     */
    public function makeDistanceSQL(float | null $lat, float | null $lon): string
    {
        if (!$lat || !$lon) {
            return '';
        }

        return ", 6378 * 2 * ASIN(SQRT(POWER(SIN(($lat - abs(lat)) * pi()/180 / 2), 2) +  COS($lat * pi()/180 ) * COS(abs(lat) * pi()/180) *  POWER(SIN(($lon - lon) * pi()/180 / 2), 2) )) AS distance";
    }

    /**
     * @param string $id
     * @param string $distanceSQL
     * @return array|object|null
     */
    public function getPlaceDataByID(string $id, string $distanceSQL): array|object|null
    {
        return $this
            ->select('places.id, places.lat, places.lon, places.views, places.photos, places.rating, places.comments,
                places.bookmarks, places.updated_at as updated, places.created_at as created, places.category,
                places.country_id, places.region_id, places.district_id, places.locality_id, places.address_ru, places.address_en,
                users.id as user_id, users.name as user_name, users.avatar as user_avatar, users.activity_at,
                location_countries.title_en as country_en, location_countries.title_ru as country_ru,
                location_regions.title_en as region_en, location_regions.title_ru as region_ru,
                location_districts.title_en as district_en, location_districts.title_ru as district_ru,
                location_localities.title_en as city_en, location_localities.title_ru as city_ru,
                category.title_ru as category_ru, category.title_en as category_en, ' . $distanceSQL)
            ->join('users', 'places.user_id = users.id', 'left')
            ->join('category', 'places.category = category.name', 'left')
            ->join('location_countries', 'location_countries.id = places.country_id', 'left')
            ->join('location_regions', 'location_regions.id = places.region_id', 'left')
            ->join('location_districts', 'location_districts.id = places.district_id', 'left')
            ->join('location_localities', 'location_localities.id = places.locality_id', 'left')
            ->find($id);
    }

    /**
     * Apply the standard list select columns and joins (with optional distance expression).
     *
     * @param string $distanceSQL  Extra SELECT expression for distance, e.g. ", 6378 * 2 * ASIN(...) AS distance". Pass '' to omit.
     * @return static
     */
    public function applyListSelect(string $distanceSQL = ''): static
    {
        $this->select(
            'places.*, users.id as user_id, users.name as user_name, users.avatar as user_avatar,
            location_countries.title_en as country_en, location_countries.title_ru as country_ru,
            location_regions.title_en as region_en, location_regions.title_ru as region_ru,
            location_districts.title_en as district_en, location_districts.title_ru as district_ru,
            location_localities.title_en as city_en, location_localities.title_ru as city_ru,
            category.title_en as category_en, category.title_ru as category_ru' . $distanceSQL
        )
        ->join('users', 'places.user_id = users.id', 'left')
        ->join('location_countries', 'location_countries.id = places.country_id', 'left')
        ->join('location_regions', 'location_regions.id = places.region_id', 'left')
        ->join('location_districts', 'location_districts.id = places.district_id', 'left')
        ->join('location_localities', 'location_localities.id = places.locality_id', 'left')
        ->join('category', 'places.category = category.name', 'left');

        return $this;
    }

    /**
     * Find an existing place by owner and exact coordinates.
     * Used to prevent duplicate submissions.
     *
     * @param string $userId
     * @param float  $lat
     * @param float  $lon
     * @return object|null
     */
    public function findDuplicate(string $userId, float $lat, float $lon): object|null
    {
        return $this
            ->select('id')
            ->where(['user_id' => $userId, 'lat' => $lat, 'lon' => $lon])
            ->first();
    }

    /**
     * Record a place view: increments the views counter, logs to places_views_log (in a transaction),
     * and optionally records per-user view tracking.
     *
     * @param string $placeId
     * @param string|null $userId
     * @param string $updatedAt  The current updated_at value to preserve (avoid touching the timestamp)
     */
    public function recordView(string $placeId, ?string $userId, string $updatedAt): void
    {
        $db = \Config\Database::connect();
        $db->transStart();

        $this->set('views', 'views + 1', false)
            ->set('updated_at', $updatedAt)
            ->where('id', $placeId)
            ->update();

        $db->query(
            'INSERT INTO places_views_log (place_id, view_date, count)
             VALUES (?, CURDATE(), 1)
             ON DUPLICATE KEY UPDATE count = count + 1',
            [$placeId]
        );

        $db->transComplete();

        // Best-effort per-user tracking — outside the transaction
        if ($userId !== null) {
            $db->query(
                'INSERT INTO users_place_views (user_id, place_id, last_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE last_at = NOW()',
                [$userId, $placeId]
            );

            // Refresh user interest profile (throttled to once per hour)
            $this->maybeRefreshUserInterests($userId);
        }
    }

    /**
     * Refresh user interest profile if not updated recently (within 1 hour).
     * This ensures recommendations stay fresh without overloading the system.
     *
     * @param string $userId
     */
    protected function maybeRefreshUserInterests(string $userId): void
    {
        $db = \Config\Database::connect();

        // Check when the user's interest profile was last updated
        $result = $db->query(
            'SELECT MAX(updated_at) AS last_update FROM users_interest_profiles WHERE user_id = ?',
            [$userId]
        )->getRow();

        $shouldRefresh = true;

        if ($result && $result->last_update) {
            $lastUpdate = strtotime($result->last_update);
            $oneHourAgo = strtotime('-1 hour');

            if ($lastUpdate > $oneHourAgo) {
                $shouldRefresh = false;
            }
        }

        if ($shouldRefresh) {
            $interestModel = new UserInterestProfilesModel();
            $interestModel->refreshForUser($userId);
        }
    }

    /**
     * Apply a sub-join that exposes weekly view sums for ordering by views_week.
     * Returns $this for chaining.
     *
     * @param string $order  'ASC' or 'DESC'
     */
    public function applyWeeklyViewsSort(string $order = 'DESC'): static
    {
        $this->join(
            '(SELECT place_id, SUM(count) AS weekly_views
              FROM places_views_log
              WHERE view_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
              GROUP BY place_id) AS pvw',
            'pvw.place_id = places.id',
            'left'
        );
        $this->orderBy('COALESCE(pvw.weekly_views, 0) ' . $order, '', false);

        return $this;
    }

    /**
     * Apply the personalized recommendation sort join for a given user.
     * Takes into account both category and tag interests.
     * Tags have higher weight (0.5) than categories (0.3) as they are more specific.
     * Returns $this for chaining.
     *
     * @param string $userId
     */
    public function applyRecommendationSort(string $userId): static
    {
        $db            = \Config\Database::connect();
        $escapedUserId = $db->escape($userId);

        // Subquery calculates recommendation score based on:
        // - Category affinity (weight 0.3) - only if not ignored
        // - Best matching tag affinity (weight 0.5) - only if not ignored
        // - Trending score (weight 0.2)
        $this->join(
            "(SELECT 
                p2.id,
                (
                    COALESCE(uip_cat.affinity, 0) * 0.3
                    + COALESCE(tag_scores.max_tag_affinity, 0) * 0.5
                    + (p2.trending_score / NULLIF((SELECT MAX(trending_score) FROM places WHERE deleted_at IS NULL), 0)) * 0.2
                ) AS rec_score
            FROM places p2
            LEFT JOIN users_interest_profiles uip_cat
                ON uip_cat.user_id = {$escapedUserId} 
                AND uip_cat.interest_type = 'category' 
                AND uip_cat.interest_value = p2.category
                AND uip_cat.ignored = 0
            LEFT JOIN (
                SELECT 
                    pt.place_id,
                    MAX(uip_tag.affinity) AS max_tag_affinity
                FROM places_tags pt
                JOIN users_interest_profiles uip_tag
                    ON uip_tag.user_id = {$escapedUserId}
                    AND uip_tag.interest_type = 'tag'
                    AND uip_tag.interest_value = pt.tag_id
                    AND uip_tag.ignored = 0
                WHERE pt.deleted_at IS NULL
                GROUP BY pt.place_id
            ) AS tag_scores ON tag_scores.place_id = p2.id
            WHERE p2.deleted_at IS NULL
            ) AS rec",
            'rec.id = places.id',
            'inner'
        );
        $this->orderBy('rec.rec_score', 'DESC');

        return $this;
    }

    /**
     * Increment the photos counter for a place.
     */
    public function incrementPhotos(string $id): void
    {
        $db = \Config\Database::connect();
        $db->query(
            'UPDATE places SET photos = photos + 1 WHERE id = ?',
            [$id]
        );
    }

    /**
     * Decrement the photos counter for a place (floor at 0).
     */
    public function decrementPhotos(string $id): void
    {
        $db = \Config\Database::connect();
        $db->query(
            'UPDATE places SET photos = GREATEST(0, photos - 1) WHERE id = ?',
            [$id]
        );
    }

    /**
     * Re-query and sync the actual photo count for a place.
     */
    public function syncPhotosCount(string $id): void
    {
        $db = \Config\Database::connect();
        $db->query(
            'UPDATE places p
             SET p.photos = (SELECT COUNT(*) FROM photos ph WHERE ph.place_id = p.id AND ph.deleted_at IS NULL)
             WHERE p.id = ?',
            [$id]
        );
    }

    /**
     * Increment the comments counter for a place.
     */
    public function incrementComments(string $id): void
    {
        $db = \Config\Database::connect();
        $db->query(
            'UPDATE places SET comments = comments + 1 WHERE id = ?',
            [$id]
        );
    }

    /**
     * Increment the bookmarks counter for a place.
     */
    public function incrementBookmarks(string $id): void
    {
        $db = \Config\Database::connect();
        $db->query(
            'UPDATE places SET bookmarks = bookmarks + 1 WHERE id = ?',
            [$id]
        );
    }

    /**
     * Decrement the bookmarks counter for a place (floor at 0).
     */
    public function decrementBookmarks(string $id): void
    {
        $db = \Config\Database::connect();
        $db->query(
            'UPDATE places SET bookmarks = GREATEST(0, bookmarks - 1) WHERE id = ?',
            [$id]
        );
    }

    /**
     * Refresh trending scores for all non-deleted places using weighted view/engagement signals.
     */
    public function refreshTrendingScores(): void
    {
        $db = \Config\Database::connect();
        $db->query(
            'UPDATE places p
            LEFT JOIN (
                SELECT place_id,
                       SUM(CASE WHEN view_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN count ELSE 0 END)  AS v7,
                       SUM(CASE WHEN view_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN count ELSE 0 END) AS v30
                FROM places_views_log
                GROUP BY place_id
            ) pvw ON pvw.place_id = p.id
            SET p.trending_score = ROUND(
                COALESCE(pvw.v7,  0) * 1.0
              + COALESCE(pvw.v30, 0) * 0.2
              + p.rating    * 20
              + p.bookmarks * 5
              + p.comments  * 3
              + p.photos    * 2,
                0
            )
            WHERE p.deleted_at IS NULL'
        );
    }
}