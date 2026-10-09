<?php

namespace App\Controllers;

use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;

/**
 * Categories controller
 *
 * The category keys are Config\Categories; the server knows nothing else
 * about a category (names, texts and icons live in the client). The only
 * endpoint left is the perelinking of a category landing page.
 *
 * @package App\Controllers
 */
class Categories extends ResourceController
{
    /**
     * Top locations for a category — perelinking for the category landing
     * page (features/20-location-seo-pages.md: "эта категория по регионам").
     *
     * GET /categories/:name/locations — optional query params:
     * level (region|locality, default region), limit (default 20, max 50).
     *
     * @example GET /categories/cave/locations?level=region&limit=10
     *
     * @param string|null $name Category key (Config\Categories).
     * @return ResponseInterface
     */
    public function locations(?string $name = null): ResponseInterface
    {
        if (!config('Categories')->has($name)) {
            return $this->failNotFound(lang('Locations.slugNotFound'));
        }

        $locale    = $this->request->getLocale();
        $level     = $this->request->getGet('level', FILTER_SANITIZE_SPECIAL_CHARS);
        $level     = in_array($level, ['region', 'locality'], true) ? $level : 'region';
        $limit     = max(1, min((int) ($this->request->getGet('limit') ?? 20), 50));
        $threshold = config('LocationSlugs')->indexThreshold;
        $table     = $level === 'region' ? 'location_regions' : 'location_localities';
        $column    = $level === 'region' ? 'region_id' : 'locality_id';

        $rows = Database::connect()
            ->table("{$table} lt")
            ->select("lt.id, lt.title_$locale as title, ls.slug, COUNT(p.id) as count")
            ->join('places p', "p.{$column} = lt.id", 'inner')
            ->join('location_slugs ls', "ls.type = '{$level}' AND ls.entity_id = lt.id", 'left')
            ->where('p.category', $name)
            ->where('p.deleted_at IS NULL', null, false)
            ->groupBy('lt.id')
            ->orderBy('count', 'DESC')
            ->limit($limit)
            ->get()->getResult();

        $items = array_map(static fn ($row) => [
            'type'        => $level,
            'id'          => (int) $row->id,
            'slug'        => $row->slug,
            'title'       => $row->title,
            'placesCount' => (int) $row->count,
            'indexable'   => (int) $row->count >= $threshold,
        ], $rows);

        return $this->respond(['items' => $items]);
    }
}