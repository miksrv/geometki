<?php

namespace App\Controllers;

use App\Entities\CollectionEntity;
use App\Libraries\ActivityLibrary;
use App\Libraries\CollectionIndexability;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Models\ActivityModel;
use App\Models\CollectionsModel;
use App\Models\CollectionsPlacesModel;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\I18n\Time;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;
use Throwable;

/**
 * Collections controller (Phase 1 MVP)
 *
 * A collection is an author-curated, published-immediately list of places
 * with a markdown description. Any registered user may create one; only the
 * owner (and admins) may edit, delete, or manage its places. Indexability
 * for search engines is computed silently — see App\Libraries\CollectionIndexability
 * — and never exposed except as the `indexable` field on the single-collection
 * response and in the sitemap.
 *
 * @package App\Controllers
 */
class Collections extends ResourceController
{
    protected SessionLibrary $session;

    protected CollectionsModel $model;

    public function __construct()
    {
        $this->model   = new CollectionsModel();
        $this->session = new SessionLibrary();
    }

    /**
     * Return a paginated, filterable list of collections.
     *
     * GET /collections — optional query params: region, category, author,
     * placeId, sort (updated|popular), limit, offset. Hidden collections are
     * always excluded.
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $locale = $this->request->getLocale();

        $region   = $this->request->getGet('region', FILTER_SANITIZE_NUMBER_INT);
        $category = $this->request->getGet('category', FILTER_SANITIZE_SPECIAL_CHARS);
        $author   = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS);
        $placeId  = $this->request->getGet('placeId', FILTER_SANITIZE_SPECIAL_CHARS);
        $sort     = $this->request->getGet('sort', FILTER_SANITIZE_SPECIAL_CHARS) ?? 'updated';
        $limit    = abs((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 20));
        $offset   = abs((int) ($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0));

        $countModel = new CollectionsModel();
        $listModel  = (new CollectionsModel())->applyListSelect();
        $countModel->applyListSelect();

        $apply = function (CollectionsModel $model) use ($region, $category, $author, $placeId) {
            $model->where('collections.hidden', 0);

            if ($region) {
                $model->where('collections.region_id', $region);
            }

            if ($category) {
                $model->where('collections.category', $category);
            }

            if ($author) {
                $model->where('collections.user_id', $author);
            }

            if ($placeId) {
                $model->join('collections_places', 'collections_places.collection_id = collections.id', 'inner')
                    ->where('collections_places.place_id', $placeId);
            }

            return $model;
        };

        $count = $apply($countModel)->countAllResults();

        $listModel = $apply($listModel);

        if ($sort === 'popular') {
            $listModel->orderBy('collections.places_count', 'DESC')->orderBy('collections.views', 'DESC');
        } else {
            $listModel->orderBy('collections.updated_at', 'DESC');
        }

        $items = $listModel->limit(min($limit, 40), $offset)->get()->getResult();

        foreach ($items as $item) {
            $this->decorate($item, $locale);
            unset($item->description, $item->indexable, $item->hidden);
        }

        return $this->respond([
            'items' => $items,
            'count' => $count,
        ]);
    }

    /**
     * Return a single collection with its ordered places, author, and slug.
     *
     * GET /collections/:id
     * Hidden collections 404 for everyone except their owner and admins.
     * The `indexable` flag is included only for the robots meta tag — it is
     * never meant to be rendered.
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $locale = $this->request->getLocale();

        $model = (new CollectionsModel())->applyListSelect();
        $collection = $model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        if (!$this->canView($collection)) {
            return $this->failNotFound();
        }

        $collectionsPlacesModel = new CollectionsPlacesModel();
        $placeIds = $collectionsPlacesModel->getOrderedPlaceIds($id);
        $notes    = $collectionsPlacesModel->getNotes($id);

        $places = [];

        if (!empty($placeIds)) {
            $placesModel = (new PlacesModel())->applyListSelect();
            $placesList  = $placesModel->whereIn('places.id', $placeIds)->get()->getResult();

            $placeContent = new PlacesContent(350);
            $placeContent->translate($placeIds);

            $byId = [];
            $formatter = new PlaceFormatterLibrary();

            foreach ($placesList as $place) {
                $place->address  = $formatter->formatAddress($place, $locale);
                $place->rating   = (int) $place->rating;
                $place->views    = (int) $place->views;
                $place->photos   = (int) $place->photos;
                $place->comments = (int) $place->comments;
                $place->bookmarks = (int) $place->bookmarks;
                $place->title    = $placeContent->title($place->id);
                $place->category = $formatter->formatCategory($place, $locale);
                $place->author   = $formatter->formatAuthor($place);
                $place->note     = $notes[$place->id] ?? null;

                $cover = $formatter->formatCover($place->id, (int) $place->photos);
                if ($cover) {
                    $place->cover = $cover;
                }

                $formatter->cleanupFields($place);

                $byId[$place->id] = $place;
            }

            foreach ($placeIds as $placeId) {
                if (isset($byId[$placeId])) {
                    $places[] = $byId[$placeId];
                }
            }
        }

        $this->decorate($collection, $locale);
        $collection->places    = $places;
        $collection->indexable = (bool) $collection->indexable;

        if (empty($collection->cover) && !empty($places)) {
            $formatter = new PlaceFormatterLibrary();
            $cover = $formatter->formatCover($places[0]->id, 1);
            if ($cover) {
                $collection->cover = $cover;
            }
        }

        $this->model->incrementViews($id);

        return $this->respond($collection);
    }

    /**
     * Create a new collection. Any authenticated user may create one; it is
     * public immediately. Rate-limited to COLLECTION_CREATE_DAILY_LIMIT per
     * rolling 24h window.
     *
     * @throws ReflectionException
     * @return ResponseInterface
     */
    public function create(): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $input = $this->request->getJSON();

        $rules = [
            'title'           => 'required|string|min_length[3]|max_length[' . COLLECTION_TITLE_MAX_LENGTH . ']',
            'description'     => 'permit_empty|string|max_length[' . COLLECTION_DESCRIPTION_MAX_LENGTH . ']',
            'metaDescription' => 'permit_empty|string|max_length[' . COLLECTION_META_DESCRIPTION_MAX_LENGTH . ']',
            'region'          => 'permit_empty|integer|is_not_unique[location_regions.id]',
            'category'        => 'permit_empty|string|is_not_unique[category.name]',
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        $userId = $this->session->user?->id;

        $since = (new Time('-1 day'))->toDateTimeString();
        if ($this->model->countCreatedSince($userId, $since) >= COLLECTION_CREATE_DAILY_LIMIT) {
            return $this->failTooManyRequests(lang('Collections.rateLimited'));
        }

        helper('slug');

        try {
            $title = strip_tags(html_entity_decode($input->title));

            $collection = new CollectionEntity();
            $collection->user_id          = $userId;
            $collection->title            = $title;
            $collection->slug             = generateCollectionSlug($title);
            $collection->description      = isset($input->description) ? strip_tags(html_entity_decode($input->description)) : null;
            $collection->meta_description = $input->metaDescription ?? null;
            $collection->region_id        = $input->region ?? null;
            $collection->category         = $input->category ?? null;
            $collection->places_count     = 0;
            $collection->indexable        = (int) CollectionIndexability::isIndexable($collection->description, 0, false);

            $insertResult = $this->model->insert($collection);

            if ($insertResult === false) {
                return $this->failValidationErrors($this->model->errors());
            }

            $newId = $this->model->getInsertID();

            return $this->respondCreated(['id' => $newId, 'slug' => $collection->slug]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Collections.createError'));
        }
    }

    /**
     * Update a collection's title, description, meta description, theme
     * (region/category), or cover. Owner or admin only.
     *
     * @param string|null $id
     * @throws ReflectionException
     * @return ResponseInterface
     */
    public function update($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $collection = $this->model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        if (!$this->isOwnerOrAdmin($collection)) {
            return $this->failForbidden();
        }

        $input = $this->request->getJSON();

        $rules = [
            'title'           => 'if_exist|required|string|min_length[3]|max_length[' . COLLECTION_TITLE_MAX_LENGTH . ']',
            'description'     => 'if_exist|permit_empty|string|max_length[' . COLLECTION_DESCRIPTION_MAX_LENGTH . ']',
            'metaDescription' => 'if_exist|permit_empty|string|max_length[' . COLLECTION_META_DESCRIPTION_MAX_LENGTH . ']',
            'region'          => 'if_exist|permit_empty|integer|is_not_unique[location_regions.id]',
            'category'        => 'if_exist|permit_empty|string|is_not_unique[category.name]',
            'coverPlaceId'    => 'if_exist|permit_empty|string',
            'coverPhotoId'    => 'if_exist|permit_empty|string',
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        helper('slug');

        try {
            $update = new CollectionEntity();
            $descriptionChanged = false;

            if (isset($input->title)) {
                $title = strip_tags(html_entity_decode($input->title));
                $update->title = $title;
                $update->slug  = generateCollectionSlug($title);
            }

            if (property_exists($input, 'description')) {
                $update->description = $input->description !== null
                    ? strip_tags(html_entity_decode($input->description))
                    : null;
                $descriptionChanged = true;
            }

            if (property_exists($input, 'metaDescription')) {
                $update->meta_description = $input->metaDescription;
            }

            if (property_exists($input, 'region')) {
                $update->region_id = $input->region;
            }

            if (property_exists($input, 'category')) {
                $update->category = $input->category;
            }

            if (property_exists($input, 'coverPlaceId')) {
                $update->cover_place_id = $input->coverPlaceId;
            }

            if (property_exists($input, 'coverPhotoId')) {
                $update->cover_photo_id = $input->coverPhotoId;
            }

            $this->model->update($id, $update);

            $effectiveDescription = $descriptionChanged ? $update->description : $collection->description;
            $this->recalcIndexable($id, $effectiveDescription, $collection->places_count, $collection->hidden);

            return $this->respondUpdated();
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Collections.updateError'));
        }
    }

    /**
     * Soft-delete a collection. Owner or admin only.
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $collection = $this->model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        if (!$this->isOwnerOrAdmin($collection)) {
            return $this->failForbidden();
        }

        $this->model->delete($id);

        return $this->respondDeleted();
    }

    /**
     * Bulk-add places to a collection. Owner or admin only. Silently skips
     * places already in the collection and places that don't exist (or are
     * deleted). Notifies each added place's owner (unless they added it
     * themselves) and records a 'collection' activity once the collection
     * first reaches COLLECTION_ACTIVITY_MIN_PLACES.
     *
     * PUT /collections/:id/places — body: { "placeIds": ["...", ...] }
     *
     * @param string|null $id
     * @throws ReflectionException
     * @return ResponseInterface
     */
    public function addPlaces($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $collection = $this->model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        if (!$this->isOwnerOrAdmin($collection)) {
            return $this->failForbidden();
        }

        $input = $this->request->getJSON();

        if (empty($input) || empty($input->placeIds) || !is_array($input->placeIds)) {
            return $this->failValidationErrors(lang('Collections.missingPlaceIds'));
        }

        if (count($input->placeIds) > COLLECTION_ADD_PLACES_MAX) {
            return $this->failValidationErrors(lang('Collections.tooManyPlaceIds', [COLLECTION_ADD_PLACES_MAX]));
        }

        $requestedIds = array_values(array_unique(array_map('strval', $input->placeIds)));

        $collectionsPlacesModel = new CollectionsPlacesModel();
        $placesModel = new PlacesModel();

        $existing      = $collectionsPlacesModel->existingMembers($id, $requestedIds);
        $candidateIds  = array_diff($requestedIds, $existing);

        $validPlaces = [];
        if (!empty($candidateIds)) {
            $validPlaces = $placesModel->select('id, user_id')->whereIn('id', $candidateIds)->findAll();
        }
        $validById = [];
        foreach ($validPlaces as $place) {
            $validById[$place->id] = $place;
        }

        $added   = [];
        $skipped = array_values(array_diff($requestedIds, array_keys($validById)));

        $position = $collectionsPlacesModel->nextPosition($id);
        $actingUserId = $this->session->user?->id;

        foreach ($candidateIds as $placeId) {
            if (!isset($validById[$placeId])) {
                continue;
            }

            $place = $validById[$placeId];
            $collectionsPlacesModel->addPlace($id, $placeId, $actingUserId, $position);
            $position++;
            $added[] = $placeId;

            if ($place->user_id && $place->user_id !== $actingUserId) {
                $activity = new ActivityLibrary();
                $activity->owner($place->user_id)->collectionPlace($id, $placeId);
            }
        }

        if (!empty($added)) {
            $newCount = $this->model->recalcPlacesCount($id);
            $this->model->autofillTheme($id);

            $fresh = $this->model->find($id);
            $this->recalcIndexable($id, $fresh->description, $newCount, $fresh->hidden);

            if ($newCount >= COLLECTION_ACTIVITY_MIN_PLACES) {
                $activityModel = new ActivityModel();
                if (!$activityModel->hasCollectionActivity($id)) {
                    // Attribute the milestone to the collection's owner even when an
                    // admin (or another acting user) is the one who added the places.
                    $activity = new ActivityLibrary();
                    $activity->collection($id, $collection->user_id);
                }
            }
        }

        return $this->respond([
            'added'       => $added,
            'skipped'     => $skipped,
            'placesCount' => $this->model->find($id)->places_count,
        ]);
    }

    /**
     * Remove a single place from a collection. Owner or admin only.
     *
     * DELETE /collections/:id/places/:placeId
     *
     * @param string|null $id
     * @param string|null $placeId
     * @return ResponseInterface
     */
    public function removePlace($id = null, $placeId = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $collection = $this->model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        if (!$this->isOwnerOrAdmin($collection)) {
            return $this->failForbidden();
        }

        $collectionsPlacesModel = new CollectionsPlacesModel();

        if (!$collectionsPlacesModel->isMember($id, $placeId)) {
            return $this->failNotFound();
        }

        $collectionsPlacesModel->removePlace($id, $placeId);

        $newCount = $this->model->recalcPlacesCount($id);

        $update = [];
        if ($collection->cover_place_id === $placeId) {
            $update['cover_place_id'] = null;
            $update['cover_photo_id'] = null;
        }
        if (!empty($update)) {
            $this->model->update($id, $update);
        }

        $fresh = $this->model->find($id);
        $this->recalcIndexable($id, $fresh->description, $newCount, $fresh->hidden);

        return $this->respondDeleted();
    }

    /**
     * Reorder a collection's places and/or update a single place's note.
     * Owner or admin only.
     *
     * PATCH /collections/:id/places — body may contain:
     *   "order": ["placeId1", "placeId2", ...]  full reorder (must be a
     *            permutation of the collection's current membership)
     *   "placeId" + "note": update one place's note
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function updatePlaces($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $collection = $this->model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        if (!$this->isOwnerOrAdmin($collection)) {
            return $this->failForbidden();
        }

        $input = $this->request->getJSON();
        $collectionsPlacesModel = new CollectionsPlacesModel();

        if (empty($input)) {
            return $this->failValidationErrors(lang('Collections.missingInput'));
        }

        if (!empty($input->order) && is_array($input->order)) {
            $current = $collectionsPlacesModel->getOrderedPlaceIds($id);
            $requested = array_map('strval', $input->order);

            sort($current);
            $sortedRequested = $requested;
            sort($sortedRequested);

            if ($current !== $sortedRequested) {
                return $this->failValidationErrors(lang('Collections.invalidOrder'));
            }

            $collectionsPlacesModel->reorder($id, $requested);
        }

        if (isset($input->placeId)) {
            if (!$collectionsPlacesModel->isMember($id, $input->placeId)) {
                return $this->failNotFound();
            }

            $note = $input->note ?? null;

            if ($note !== null && mb_strlen($note, 'UTF-8') > COLLECTION_NOTE_MAX_LENGTH) {
                return $this->failValidationErrors(lang('Collections.noteTooLong'));
            }

            $collectionsPlacesModel->updateNote($id, $input->placeId, $note);
        }

        $this->model->touch($id);

        return $this->respondUpdated();
    }

    /**
     * Return the current authenticated user's own collections, each with a
     * `contains` flag for the given place. Feeds the "Add to collection"
     * modal on a place page.
     *
     * GET /collections/membership?placeId=:id
     *
     * @return ResponseInterface
     */
    public function membership(): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $placeId = $this->request->getGet('placeId', FILTER_SANITIZE_SPECIAL_CHARS);
        $userId  = $this->session->user?->id;

        $model = new CollectionsModel();
        $collections = $model
            ->select('id, title, places_count, cover_place_id')
            ->where('user_id', $userId)
            ->orderBy('updated_at', 'DESC')
            ->findAll();

        $containingIds = [];
        if ($placeId) {
            $collectionsPlacesModel = new CollectionsPlacesModel();
            $containingIds = $collectionsPlacesModel->collectionIdsForUserAndPlace($userId, $placeId);
        }

        $formatter = new PlaceFormatterLibrary();
        $items = [];

        foreach ($collections as $collection) {
            $cover = $collection->cover_place_id ? $formatter->formatCover($collection->cover_place_id, 1) : null;

            $items[] = [
                'id'          => $collection->id,
                'title'       => $collection->title,
                'placesCount' => (int) $collection->places_count,
                'cover'       => $cover,
                'contains'    => in_array($collection->id, $containingIds, true),
            ];
        }

        return $this->respond(['items' => $items]);
    }

    /**
     * Return places in the collection's region and category that are not
     * already in it, sorted by rating. Feeds the "Рекомендуем" add-places tab.
     *
     * GET /collections/:id/recommended?limit=
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function recommended($id = null): ResponseInterface
    {
        $locale = $this->request->getLocale();
        $limit  = abs((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 20));

        $collection = $this->model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        if (!$this->canView($collection)) {
            return $this->failNotFound();
        }

        if (empty($collection->region_id) && empty($collection->category)) {
            return $this->respond(['items' => [], 'count' => 0]);
        }

        $collectionsPlacesModel = new CollectionsPlacesModel();
        $existingIds = $collectionsPlacesModel->getOrderedPlaceIds($id);

        $placesModel = (new PlacesModel())->applyListSelect();

        if (!empty($collection->region_id)) {
            $placesModel->where('places.region_id', $collection->region_id);
        }

        if (!empty($collection->category)) {
            $placesModel->where('places.category', $collection->category);
        }

        if (!empty($existingIds)) {
            $placesModel->whereNotIn('places.id', $existingIds);
        }

        $placesList = $placesModel->orderBy('places.rating', 'DESC')->limit(min($limit, 40))->get()->getResult();
        $placeIds   = array_column($placesList, 'id');

        $placeContent = new PlacesContent(350);
        $placeContent->translate($placeIds);

        $formatter = new PlaceFormatterLibrary();
        foreach ($placesList as $place) {
            $place->address   = $formatter->formatAddress($place, $locale);
            $place->rating    = (int) $place->rating;
            $place->views     = (int) $place->views;
            $place->photos    = (int) $place->photos;
            $place->comments  = (int) $place->comments;
            $place->bookmarks = (int) $place->bookmarks;
            $place->title     = $placeContent->title($place->id);
            $place->category  = $formatter->formatCategory($place, $locale);
            $place->author    = $formatter->formatAuthor($place);

            $cover = $formatter->formatCover($place->id, (int) $place->photos);
            if ($cover) {
                $place->cover = $cover;
            }

            $formatter->cleanupFields($place);
        }

        return $this->respond([
            'items' => $placesList,
            'count' => count($placesList),
        ]);
    }

    /**
     * Admin moderation: hide or feature a collection.
     *
     * PATCH /collections/:id/moderation — body: { hidden?, featured? }
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function moderation($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user->role !== 'admin') {
            return $this->failUnauthorized();
        }

        $collection = $this->model->find($id);

        if (!$collection) {
            return $this->failNotFound();
        }

        $input = $this->request->getJSON();
        $update = [];

        if (isset($input->hidden)) {
            $update['hidden'] = $input->hidden ? 1 : 0;
        }

        if (isset($input->featured)) {
            $update['featured'] = $input->featured ? 1 : 0;
        }

        if (empty($update)) {
            return $this->failValidationErrors(lang('Collections.missingInput'));
        }

        $this->model->update($id, $update);

        $fresh = $this->model->find($id);
        $this->recalcIndexable($id, $fresh->description, $fresh->places_count, $fresh->hidden);

        return $this->respondUpdated();
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Whether the current session may view a (possibly hidden) collection:
     * anyone when not hidden, otherwise only the owner or an admin.
     *
     * @param object $collection Must expose user_id (or owner_id) and hidden.
     * @return bool
     */
    protected function canView(object $collection): bool
    {
        if (empty($collection->hidden)) {
            return true;
        }

        return $this->isOwnerOrAdmin($collection);
    }

    /**
     * Whether the current session is the collection's owner or an admin.
     *
     * @param object $collection Must expose user_id (or owner_id).
     * @return bool
     */
    protected function isOwnerOrAdmin(object $collection): bool
    {
        if (!$this->session->isAuth || !$this->session->user) {
            return false;
        }

        if ($this->session->user->role === 'admin') {
            return true;
        }

        $ownerId = $collection->owner_id ?? $collection->user_id ?? null;

        return $ownerId === $this->session->user->id;
    }

    /**
     * Recompute and persist the indexable flag for a collection.
     *
     * @param string $id
     * @param string|null $description
     * @param int $placesCount
     * @param bool|int $hidden
     * @return void
     */
    protected function recalcIndexable(string $id, ?string $description, int $placesCount, $hidden): void
    {
        $indexable = CollectionIndexability::isIndexable($description, $placesCount, (bool) $hidden);
        $this->model->skipValidation(true)->update($id, ['indexable' => (int) $indexable]);
    }

    /**
     * Decorate a raw collection row (from applyListSelect()) with author,
     * region, category, metaDescription, cover, and date objects, in place.
     *
     * @param object $row
     * @param string $locale
     * @return void
     */
    protected function decorate(object $row, string $locale): void
    {
        $formatter = new PlaceFormatterLibrary();

        $row->author = $formatter->formatAuthor($row);

        $row->region = !empty($row->region_id)
            ? ['id' => (int) $row->region_id, 'name' => $row->{"region_$locale"} ?? null]
            : null;

        $row->category = !empty($row->category)
            ? ['name' => $row->category, 'title' => $row->{"category_$locale"} ?? null]
            : null;

        $row->metaDescription = $row->meta_description
            ?: mb_substr(CollectionIndexability::stripMarkdown((string) $row->description), 0, 160, 'UTF-8');

        $row->placesCount = (int) $row->places_count;
        $row->views       = (int) $row->views;
        $row->saves       = (int) $row->saves;
        $row->featured    = (bool) $row->featured;

        if (!empty($row->cover_place_id)) {
            $cover = $formatter->formatCover($row->cover_place_id, 1);
            if ($cover) {
                $row->cover = $cover;
            }
        }

        if (!empty($row->updated)) {
            $row->updated = new \DateTime((string) $row->updated);
        }

        if (!empty($row->created)) {
            $row->created = new \DateTime((string) $row->created);
        }

        unset(
            $row->region_id, $row->region_en, $row->region_ru,
            $row->category_en, $row->category_ru,
            $row->user_id, $row->user_name, $row->user_avatar,
            $row->meta_description, $row->places_count,
            $row->cover_place_id, $row->cover_photo_id,
            $row->owner_id
        );
    }
}
