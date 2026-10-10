<?php

namespace App\Controllers;

use App\Models\TagsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * Tags controller
 *
 * A typeahead search endpoint for the tag input field.
 *
 * @package App\Controllers
 */
class Tags extends ResourceController
{

    protected $model;

    public function __construct()
    {
        $this->model = new TagsModel();
    }

    /**
     * Return up to 10 tags whose title matches the search text.
     *
     * GET /tags/search?text=:query
     * Returns an empty list when the query is empty or exceeds 30 characters.
     *
     * @return ResponseInterface
     */
    public function search(): ResponseInterface
    {
        $search = trim($this->request->getGet('text', FILTER_DEFAULT));
        $locale = $this->request->getLocale();

        if (strlen($search) === 0 || strlen($search) >= 30) {
            return $this->respond(['items' => []]);
        }

        $result = $this->model
            ->select('title_ru, title_en')
            ->orLike(['title_ru' => $search, 'title_en' => $search])
            ->findAll(10);

        if (empty($result)) {
            return $this->respond(['items' => []]);
        }

        $response = [];

        foreach ($result as $tag) {
            $response[] = $locale === 'en' && !empty($tag->title_en)
                ? $tag->title_en
                : (!empty($tag->title_ru) ? $tag->title_ru : $tag->title_en);
        }

        return $this->respond(['items' => $response]);
    }
}