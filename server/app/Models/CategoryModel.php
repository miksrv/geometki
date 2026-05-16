<?php

namespace App\Models;

use App\Entities\CategoryEntity;
use CodeIgniter\Model;

/**
 * Model for the `category` table.
 *
 * Categories are managed directly in the database and are read-only through
 * the API. $allowedFields is intentionally empty to prevent mass-assignment.
 * No timestamps are tracked.
 *
 * @package App\Models
 */
class CategoryModel extends Model
{
    protected $table            = 'category';
    protected $primaryKey       = 'name';
    protected $useAutoIncrement = false;
    protected $returnType       = CategoryEntity::class;
    protected $useSoftDeletes   = false;

    /**
     * Intentionally empty — categories are not created or updated via the API.
     *
     * @var array<int, string>
     */
    protected $allowedFields = [];

    protected $useTimestamps = false;

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = false;

    /**
     * Return the top $limit categories ordered by weekly views.
     * If fewer than $limit categories have weekly view data, the remainder is
     * filled with the most-populated categories (by total place count).
     *
     * @param int    $limit
     * @param string $locale  'ru' or 'en'
     * @return array
     */
    public function getTopByWeeklyViews(int $limit, string $locale): array
    {
        $weekly = $this->db->query("
            SELECT
                c.name,
                c.title_{$locale}   AS title,
                c.content_{$locale} AS content,
                SUM(pvl.count)      AS weekly_views
            FROM category c
            INNER JOIN places p
                ON p.category = c.name
               AND p.deleted_at IS NULL
            INNER JOIN places_views_log pvl
                ON pvl.place_id = p.id
               AND pvl.view_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY c.name, c.title_{$locale}, c.content_{$locale}
            ORDER BY weekly_views DESC
            LIMIT ?
        ", [$limit])->getResultObject();

        $remaining = $limit - count($weekly);

        if ($remaining <= 0) {
            return $weekly;
        }

        $exclude      = array_map(fn($r) => $r->name, $weekly);
        $placeholders = $exclude
            ? 'AND c.name NOT IN (' . implode(',', array_fill(0, count($exclude), '?')) . ')'
            : '';

        $fallback = $this->db->query("
            SELECT
                c.name,
                c.title_{$locale} AS title,
                c.content_{$locale} AS content,
                NULL AS weekly_views
            FROM category c
            INNER JOIN places p ON p.category = c.name AND p.deleted_at IS NULL
            WHERE 1=1 {$placeholders}
            GROUP BY c.name, c.title_{$locale}, c.content_{$locale}
            ORDER BY COUNT(p.id) DESC
            LIMIT ?
        ", [...$exclude, $remaining])->getResultObject();

        return array_merge($weekly, $fallback);
    }
}
