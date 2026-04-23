<?php

namespace App\Controllers;

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
}