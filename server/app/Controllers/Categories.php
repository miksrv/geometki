<?php

namespace App\Controllers;

use App\Libraries\PlaceFormatterLibrary;
use App\Models\CategoryModel;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;

/**
 * Categories controller
 *
 * Returns the place category catalogue with optional per-category place counts.
 *
 * @package App\Controllers
 */
class Categories extends ResourceController
{

    protected $model;

    public function __construct()
    {
        $this->model = new CategoryModel();
    }

    /**
     * Return all categories, optionally enriched with place counts.
     *
     * GET /categories — optional query param: places (boolean).
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $places = $this->request->getGet('places', FILTER_VALIDATE_BOOLEAN) ?? false;
        $locale = $this->request->getLocale();
        $data   = $this->model
            ->select("name, title_$locale as title" . ($places ? ", content_$locale as content" : ''))
            ->orderBy("title_$locale", 'ASC')
            ->findAll();

        if (empty($data)) {
            return $this->respond(['items' => []]);
        }

        if ($places) {
            $placesModel = new PlacesModel();

            foreach ($data as $item) {
                $item->count = $placesModel->getCountPlacesByCategory($item->name);
            }
        }

        return $this->respond(['items' => $data]);
    }

    /**
     * Return the top 3 most-viewed categories over the last 7 days.
     *
     * GET /categories/top
     *
     * Each item includes the localised name/title/content, total place count,
     * and cover image URLs sourced from the most-viewed place in that category.
     *
     * @return ResponseInterface
     */
    public function top(): ResponseInterface
    {
        $locale        = $this->request->getLocale();
        $limit         = max(1, min((int) ($this->request->getGet('limit') ?? 3), 10));
        $placesModel   = new PlacesModel();
        $formatter     = new PlaceFormatterLibrary();

        $topCategories = $this->model->getTopByWeeklyViews($limit, $locale);

        if (empty($topCategories)) {
            return $this->respond(['items' => []]);
        }

        foreach ($topCategories as $category) {
            $category->count = $placesModel->getCountPlacesByCategory($category->name);

            $coverPlace      = $placesModel->getCoverPlaceByCategory($category->name);
            $category->cover = $coverPlace
                ? $formatter->formatCover($coverPlace->id, (int) $coverPlace->photos)
                : null;

            unset($category->weekly_views);
        }

        return $this->respond(['items' => $topCategories]);
    }

    /**
     * Top locations for a category — perelinking for the category landing
     * page (features/20-location-seo-pages.md: "эта категория по регионам").
     *
     * GET /categories/:name/locations — optional query params:
     * level (region|locality, default region), limit (default 20, max 50).
     *
     * @example GET /categories/cave/locations?level=region&limit=10
     *
     * @param string|null $name Category name (primary key of `category`).
     * @return ResponseInterface
     */
    public function locations(?string $name = null): ResponseInterface
    {
        if (!$name || !$this->model->find($name)) {
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