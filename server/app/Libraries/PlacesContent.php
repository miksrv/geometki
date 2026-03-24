<?php namespace App\Libraries;

use App\Models\PlacesContentModel;
use Config\Services;

/**
 * Class for find actual translation for place
 *
 * Как работать:
 *
 * 1) Импортируем:
 *    $placeContent = new PlacesContent(350);
 *    350 - обрезает контент
 * 2) Находим перевод для объектов:
 *    A: Если используется поиск $placeContent->search('кратер');
 *    B: Если уже известен массив объектов: $placeContent->translate([{ID}, {ID}]);
 * 3) Для того, чтобы вернуть ID всех найденных объектов: $placeContent->placeIds;
 * 4) Перевод для каждого конкретного:
 *    А: Заголовок $placeContent->title({ID});
 *    B: Контент $placeContent->content({ID});
 */
class PlacesContent {

    protected array $places = [];
    protected array $versions = [];
    public array $placeIds = [];
    protected int $trim;
    protected string $search;

    protected bool $keepVersions = false;

    private PlacesContentModel $model;

    /**
     * When calling the constructor, we set the parameters and start working with the model.
     * The library works in two modes:
     *  1) Search by keyword and return a list of location and content IDs for each
     *  2) Gets a list of place IDs, extracts content for them and returns it
     * @param int $trim
     */
    public function __construct(int $trim = 0) {
        $this->model = new PlacesContentModel();
        $this->trim  = $trim;

        $this->model->select(
            'id, place_id, title, user_id, locale, delta, created_at, updated_at,' .
            ($this->trim > 0 ? 'SUBSTRING(places_content.content, 1, ' . $this->trim . ') as content' : 'places_content.content')
        );
    }

    /**
     * @param string $term
     * @return void
     */
    public function search(string $term): void {
        $this->search = $term;

        $data = $this->model
            ->like('title', $term)
            ->orLike('content', $term)
            ->orderBy('created_at', 'DESC')
            ->findAll();

        $this->_prepareOutput($data);
    }

    /**
     * When we request translations for all places, we can immediately indicate whether we should store content
     * versions for each translation or not (these versions are needed so that when requesting an activity,
     * we can compare the translation of the place on the date the activity was added)
     * @param array $placeIds
     * @param bool $keepVersions
     * @return void
     */
    public function translate(array $placeIds, bool $keepVersions = false): void {
        $this->placeIds = array_unique($placeIds);

        if (empty($this->placeIds)) {
            return ;
        }

        // Setting a global variable
        // #TODO
        $this->keepVersions = $keepVersions === true;

        // Fetch only the latest content record per (place_id, locale) pair to avoid
        // loading all historical versions for every place.
        $data = $this->model
            ->whereIn('place_id', $this->placeIds)
            ->where('created_at = (SELECT MAX(pc2.created_at) FROM places_content pc2 WHERE pc2.place_id = places_content.place_id AND pc2.locale = places_content.locale)')
            ->orderBy('created_at', 'DESC')
            ->findAll();

        foreach ($this->placeIds as $placeId) {
            $this->places[$placeId] = $this->_findPlaceContent($placeId, $data);
        }
    }

    /**
     * Return title for place by ID
     * @param string $placeId
     * @return string
     */
    public function title(string $placeId): string {
        return $this->get($placeId, 'title');
    }

    /**
     * Return title for place by ID
     * @param string $placeId
     * @return string|null
     */
    public function content(string $placeId): string | null {
        return $this->get($placeId, 'content');
    }

    /**
     * Return author ID for translation place by ID
     * @param string $placeId
     * @return string
     */
    public function author(string $placeId): string {
        return $this->get($placeId, 'user_id');
    }

    /**
     * Return locale for translation place by ID
     * @param string $placeId
     * @return string
     */
    public function locale(string $placeId): string {
        return $this->get($placeId, 'locale');
    }

    /**
     * Return updated time for translation place by ID
     * @param string $placeId
     * @return string
     */
    public function updated(string $placeId): string {
        return $this->get($placeId, 'updated_at');
    }

    /**
     * Return updated time for translation place by ID
     * @param string $placeId
     * @return string
     */
    public function id(string $placeId): string {
        return $this->get($placeId, 'id');
    }

    /**
     * @param string $id
     * @param string $field
     * @param string|null $version
     * @return string|null
     */
    public function get(string $id, string $field, string $version = null): string | null {
        if ($version && isset($this->versions[$id])) {
            $findKey = array_search($version, array_column($this->versions[$id], 'created_at'));

            if ($findKey !== false) {
                return $this->versions[$id][$findKey]->{$field};
            }
        }

        if (isset($this->places[$id])) {
            return $this->places[$id]->{$field};
        }

        return '';
    }

    /**
     * Prepares an array $this->places containing translations for each location.
     * Also, if $this->placeIds is empty, then fill it with the found IDs of places for
     * which matches to the search criteria were found.
     * @param array $data translations data for all places (by array of IDs)
     * @return array|void
     */
    protected function _prepareOutput(array $data) {
        if (empty($data)) {
            return $this->places;
        }

        foreach ($data as $item) {
            // While searching through each translation - if a translation has already been found for the location
            // (and it was added to the general array of ready-made translations)
            // and if the date of the added translation is greater than the date of the current searched region -
            // we add such a translation to the history and move on.
            if (
                isset($this->places[$item->place_id]) &&
                strtotime($this->places[$item->place_id]->created_at) > strtotime($item->created_at)
            ) {
                if ($this->keepVersions) {
                    $this->versions[$item->place_id][] = $item;
                }

                continue;
            }

            $this->placeIds[] = $item->place_id;
            $this->places[$item->place_id] = $item;
        }
    }

    /**
     * @param string $placeId
     * @param array $data
     * @return array|void
     */
    private function _findPlaceContent(string $placeId, array $data) {
        $request = Services::request();

        foreach ($data as $item) {
            if ($item->place_id === $placeId && $item->locale === $request->getLocale()) {
                return $item;
            }
        }

        foreach ($data as $item) {
            if ($item->place_id === $placeId && $item->locale === ($request->getLocale() === 'ru' ? 'en' : 'ru')) {
                return $item;
            }
        }
    }
}