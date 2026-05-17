<?php

namespace App\Controllers;

use App\Libraries\PlaceFormatterLibrary;
use App\Models\CategoryModel;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

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
        $limit         = min((int) ($this->request->getGet('limit') ?? 3), 10);
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
}