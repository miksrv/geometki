<?php

namespace App\Controllers;

use App\Models\CategoryModel;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Categories API controller (not use now)
 */
class Categories extends ResourceController
{

    protected $model;

    public function __construct()
    {
        $this->model = new CategoryModel();
    }

    /**
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
            $this->respond(['items'  => []]);
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