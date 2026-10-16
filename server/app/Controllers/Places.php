<?php

namespace App\Controllers;

use App\Entities\PhotoEntity;
use App\Entities\PlaceEntity;
use App\Libraries\AvatarLibrary;
use App\Libraries\Geocoder;
use App\Libraries\PhotoLibrary;
use App\Libraries\PlaceCoverLibrary;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlaceTags;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Libraries\ActivityLibrary;
use App\Models\ActivityModel;
use App\Models\CollectionsModel;
use App\Models\CollectionsPlacesModel;
use App\Models\LocationSlugsModel;
use App\Models\OsmCandidatesModel;
use App\Models\PhotosModel;
use App\Models\PlacesExternalPhotosModel;
use App\Models\PlacesModel;
use App\Models\PlacesTagsModel;
use App\Models\PlacesContentModel;
use App\Models\TagsModel;
use App\Models\UsersBookmarksModel;
use App\Models\UsersVisitedPlacesModel;
use CodeIgniter\Files\File;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Geocoder\Exception\Exception;
use ReflectionException;
use Throwable;

/**
 * Places controller
 *
 * Core CRUD controller for the POI (places) resource. Handles listing with
 * rich filtering/sorting, single-place retrieval, creation with geocoding and
 * temporary-photo migration, content editing, cover image generation, and
 * admin-only deletion.
 *
 * @package App\Controllers
 */
class Places extends ResourceController
{
    protected bool $coordinatesAvailable = false;

    protected SessionLibrary $session;

    protected $model;

    public function __construct()
    {
        $this->model   = new PlacesModel();
        $this->session = new SessionLibrary();
    }

    /**
     * Return a paginated, filterable list of places.
     *
     * GET /places — optional query params: sort, order, category (comma-
     * separated list accepted), limit, offset, author, country, region,
     * district, locality, location (a location slug — see GET /locations/resolve
     * — in addition to the id-based params), search, tag, bookmarkUser,
     * lat, lon, excludePlaces, missingLocale (places with no text in that locale),
     * notVisited (signed-in visitors only: drops the places they marked "I was here").
     * For a signed-in visitor every item also carries `bookmarked` and `visited`, so a list
     * of cards needs no request per card.
     *
     * @throws \Exception
     *
     * @example GET /places?sort=rating&order=ASC&category=historic&limit=20&offset=1
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $bookmarksUser = $this->request->getGet('bookmarkUser', FILTER_SANITIZE_SPECIAL_CHARS);
        $lat    = $this->request->getGet('lat', FILTER_VALIDATE_FLOAT);
        $lon    = $this->request->getGet('lon', FILTER_VALIDATE_FLOAT);
        $tag    = $this->request->getGet('tag', FILTER_SANITIZE_SPECIAL_CHARS);
        $search = $this->request->getGet('search', FILTER_SANITIZE_SPECIAL_CHARS);
        $locale = $this->request->getLocale();
        $bookmarksPlacesIds = [];

        // if filtering of interesting places by user bookmark is specified,
        // then we find all the bookmarks of this user, and then extract all the IDs of places in the bookmarks
        if ($bookmarksUser) {
            $bookmarksModel = new UsersBookmarksModel();
            $bookmarksData  = $bookmarksModel->select('place_id')->where('user_id', $bookmarksUser)->findAll();

            if ($bookmarksData) {
                foreach ($bookmarksData as $bookmark) {
                    $bookmarksPlacesIds[] = $bookmark->place_id;
                }
            }
        }

        // if filtering by tag ID
        if ($tag) {
            $tagModel = new TagsModel();
            $tagData  = $tagModel
                ->select('id')
                ->orWhere(['title_ru' => $tag, 'title_en' => $tag])
                ->first();

            if (!$tagData || !$tagData->id) {
                return $this->respond([
                    'items'  => [],
                    'count'  => 0,
                ]);
            }

            $placesTagsModel = new PlacesTagsModel();
            $placesTagsData  = $placesTagsModel
                ->select('place_id')
                ->where('tag_id', $tagData->id)
                ->groupBy('place_id')
                ->findAll();

            if (empty($placesTagsData)) {
                return $this->respond([
                    'items'  => [],
                    'count'  => 0,
                ]);
            }

            $tag = array_column($placesTagsData, 'place_id');
        } else {
            $tag = [];
        }

        // Filtering by user bookmarks (like any other) - if we don’t find a single place in the bookmarks, we return an empty array
        if ($bookmarksUser && empty($bookmarksPlacesIds)) {
            return $this->respond([
                'items'  => [],
                'count'  => 0,
            ]);
        }

        // Load translate library
        $placeContent = new PlacesContent(350);

        // When searching, we search by criteria in the translation array to return object IDs
        if ($search) {
            $placeContent->search($search);

            // At the same time, if we did not find anything based on the search conditions,
            // we immediately return an empty array and do not execute the code further
            if (empty($placeContent->placeIds)) {
                return $this->respond([
                    'items'  => [],
                    'count'  => 0,
                ]);
            }
        }

        $coordinates = $this->model->makeDistanceSQL($lat ?: null, $lon ?: null);

        if ($coordinates) {
            $this->coordinatesAvailable = true;
        }

        $this->model->applyListSelect($coordinates);

        // If search or any other filter is not used, then we always use an empty array
        $searchPlacesIds = !$search && !$bookmarksUser && !$tag
            ? []
            : array_unique(array_merge($placeContent->placeIds, $bookmarksPlacesIds, $tag));

        // Find all places
        // If a search was enabled, the second argument to the _makeListFilters function will contain the
        // IDs of the places found using the search criteria
        $countModel = new PlacesModel();
        $countModel->applyListSelect($coordinates);
        $placesCount = $this->makeListFilters($countModel, $searchPlacesIds)->countAllResults();

        $placesList = $this->makeListFilters($this->model, $searchPlacesIds)->get()->getResult();
        $placesIds  = array_column($placesList, 'id');

        // We find translations for all objects if no search was used.
        // When searching, we already know translations for all found objects
        if (!$search) {
            $placeContent->translate($placesIds);
        }

        // Mapping places to array list
        $formatter = new PlaceFormatterLibrary();
        foreach ($placesList as $place) {
            if ($coordinates && $place->distance) {
                $place->distance = $formatter->formatDistance($place->distance);
            }

            $formatter->formatListRow($place, $locale, $placeContent->title($place->id));
        }

        $this->markVisitorState($placesList, $placesIds);

        return $this->respond([
            'items'  => $placesList,
            'count'  => $placesCount,
        ]);
    }

    /**
     * Return the full detail view for a single place.
     *
     * GET /places/:id — optional query params: lat, lon.
     * Increments the view counter and records a per-user view log.
     *
     * @param string|null $id Place primary key.
     *
     * @throws ReflectionException
     * @throws \Exception
     *
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $locale = $this->request->getLocale();
        $lat    = $this->request->getGet('lat', FILTER_VALIDATE_FLOAT);
        $lon    = $this->request->getGet('lon', FILTER_VALIDATE_FLOAT);

        // Load translate library
        $placeContent = new PlacesContent();
        $placeContent->translate([$id]);

        if (!$placeContent->title($id)) {
            return $this->failNotFound();
        }

        $coordinates = $this->model->makeDistanceSQL($lat ?: null, $lon ?: null);

        $placeData = $this->model->getPlaceDataByID($id, $coordinates);

        if (!$placeData) {
            return $this->failNotFound();
        }

        // Collect tags
        $placesTagsModel = new PlacesTagsModel();
        $placeData->tags = $placesTagsModel->getAllByPlaceId($id);

        $formatter = new PlaceFormatterLibrary();
        $avatarLibrary = new AvatarLibrary();
        $placeData->editors = $this->editors($id, $placeData->user_id);
        $placeData->author  = [
            'id'       => $placeData->user_id,
            'name'     => $placeData->user_name,
            'activity' => $placeData->activity_at ? new \DateTime($placeData->activity_at) : null,
            'avatar'   => $avatarLibrary->buildPath($placeData->user_id, $placeData->user_avatar, 'small'),
        ];

        $cover = $formatter->formatCover($id, (int) $placeData->photos, $placeData->cover_external_id ?? null);
        if ($cover) {
            // A cover cut from a linked photo is credited under it (author, licence, source)
            $coverSource = $placeData->cover_external_id
                ? (new PlacesExternalPhotosModel())->find($placeData->cover_external_id)
                : null;

            if ($coverSource) {
                $cover['credit'] = PlacesExternalPhotosModel::formatAsCoverCredit($coverSource);
            }

            $placeData->cover = $cover;
        }

        $placeData->address = $formatter->formatAddress($placeData, $locale);

        if ($coordinates && $placeData->distance) {
            $placeData->distance = $formatter->formatDistance($placeData->distance);
        }

        if ($placeData->{"address_$locale"}) {
            $placeData->address->street = $placeData->{"address_$locale"};
        }

        if ($placeData->tags) {
            $tags = [];

            foreach ($placeData->tags as $tag) {
                $tags[] = $locale === 'en' && !empty($tag->title_en)
                    ? $tag->title_en
                    : (!empty($tag->title_ru) ? $tag->title_ru : $tag->title_en);
            }

            $placeData->tags = $tags;
        }

        $placeData->title   = $placeContent->title($id);
        $placeData->content = $this->plainContent($placeContent->content($id));
        // The locale of title/content: differs from the request locale when the place has no text in it
        $placeData->locale  = $placeContent->locale($id);
        $placeData->locales = $placeContent->locales($id);

        $placeData->visitRadiusM       = (int) $placeData->visit_radius_m;
        $placeData->verificationExempt = (bool) $placeData->verification_exempt;

        unset($placeData->user_id, $placeData->user_name, $placeData->user_avatar, $placeData->activity_at,
            $placeData->country_id, $placeData->region_id, $placeData->district_id, $placeData->locality_id,
            $placeData->address_en, $placeData->address_ru,
            $placeData->country_en, $placeData->country_ru,
            $placeData->region_en, $placeData->region_ru,
            $placeData->district_en, $placeData->district_ru,
            $placeData->city_en, $placeData->city_ru,
            $placeData->visit_radius_m, $placeData->verification_exempt, $placeData->cover_external_id,
        );

        // Incrementing view counter + daily log (atomic) + optional per-user tracking
        $userId = ($this->session->isAuth && $this->session->user) ? $this->session->user->id : null;
        $this->model->recordView($id, $userId, $placeData->updated);

        return $this->respond($placeData);
    }

    /**
     * Return the current title and description of a place in every locale it has one in.
     *
     * GET /places/:id/texts — no fallback between locales: a missing locale is simply
     * not in the list. Used to edit or translate the text of a specific locale.
     *
     * @param string|null $id Place primary key.
     *
     * @return ResponseInterface
     */
    public function texts($id = null): ResponseInterface
    {
        if (!$id || !$this->model->find($id)) {
            return $this->failNotFound();
        }

        $items = array_map(fn($text) => [
            'locale'  => $text->locale,
            'title'   => $text->title,
            'content' => $this->plainContent($text->content),
            'updated' => $text->updated_at,
        ], (new PlacesContentModel())->findTexts($id));

        return $this->respond(['items' => $items]);
    }

    /**
     * Create a new place with geocoding and optional photo migration.
     *
     * POST /places — auth required.
     * Validates coordinates and category, resolves the address via Geocoder,
     * saves the place inside a transaction, migrates temporary photos, and
     * records an activity event.
     *
     * @throws ReflectionException
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function create(): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $locale = $this->request->getLocale();
        $input  = $this->request->getJSON();
        $rules  = [
            'title'    => 'required|min_length[8]|max_length[200]',
            'category' => 'required|in_list[' . implode(',', config('Categories')->names) . ']',
            'lat'      => 'numeric|min_length[3]',
            'lon'      => 'numeric|min_length[3]',
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        helper('slug');

        try {
            $placeTitle   = isset($input->title) ? strip_tags(html_entity_decode($input->title)) : null;
            $placeContent = isset($input->content) ? strip_tags(html_entity_decode($input->content)) : null;

            $existingPlace = $this->model->findDuplicate(
                $this->session->user?->id,
                $input->lat,
                $input->lon
            );

            if ($existingPlace) {
                return $this->respondCreated(['id' => $existingPlace->id]);
            }

            $placeTags = new PlaceTags();
            $geocoder  = new Geocoder();
            $place     = new \App\Entities\PlaceEntity();

            if (!$geocoder->coordinates($input->lat, $input->lon)) {
                return $this->failValidationErrors(lang('Places.createFailError'));
            }

            $place->lat         = $input->lat;
            $place->lon         = $input->lon;
            $place->user_id     = $this->session->user?->id;
            $place->category    = $input->category;
            $place->slug        = generatePlaceSlug($placeTitle);
            $place->address_en  = $geocoder->addressEn;
            $place->address_ru  = $geocoder->addressRu;
            $place->country_id  = $geocoder->countryId;
            $place->region_id   = $geocoder->regionId;
            $place->district_id = $geocoder->districtId;
            $place->locality_id = $geocoder->localityId;

            $db = \Config\Database::connect();
            $db->transStart();

            $insertResult = $this->model->insert($place);

            if ($insertResult === false) {
                log_message('error', 'Failed to insert place: ' . json_encode($this->model->errors()));
                return $this->failValidationErrors($this->model->errors());
            }

            $newPlaceId = $this->model->getInsertID();

            if (!empty($input->tags)) {
                $placeTags->saveTags($input->tags, $newPlaceId);
            }

            $placesContentModel = new PlacesContentModel();

            $content = new \App\Entities\PlaceContentEntity();
            $content->place_id = $newPlaceId;
            $content->locale   = $locale;
            $content->user_id  = $this->session->user?->id;
            $content->title    = $placeTitle;
            $content->content  = $placeContent;

            $placesContentModel->saveContent($content);

            $activity = new ActivityLibrary();
            $activity->place($newPlaceId);

            if (!empty($input->photos)) {
                $this->savePhotos($input->photos, $newPlaceId, $place, $content);
            }

            // Created from an OSM candidate: the same link an admin sets by hand, hides it from the map.
            // Only a similar place takes it, otherwise the candidate stays on the map
            if (!empty($input->candidate) && is_string($input->candidate)) {
                (new OsmCandidatesModel())->linkToNewPlace(
                    $input->candidate,
                    $newPlaceId,
                    $this->session->user?->id,
                    (float) $input->lat,
                    (float) $input->lon,
                    (string) $input->category,
                    [$placeTitle]
                );
            }

            $db->transComplete();

            if (!$db->transStatus()) {
                log_message('error', 'Places::create: transaction rolled back: {error}', ['error' => json_encode($db->error())]);

                return $this->failServerError(lang('Places.createTransactionError'));
            }

            return $this->respondCreated(['id' => $newPlaceId]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Places.createTransactionError'));
        }
    }

    /**
     * Update place content, tags, category, and/or coordinates.
     *
     * PATCH /places/:id — auth required.
     * The text is saved per locale and logged as a revision; edits by the same author
     * within 24 hours update their last revision (PlacesContentModel::saveContent()).
     * The text locale is the `locale` body field, or the request locale (`Locale` header)
     * when it is not given. A field left out keeps its current value in that same locale;
     * a locale the place has no text in yet needs a title (and a description, when the
     * place has one in another locale), so a translation never inherits the original text.
     * Edits by a `bot` user leave no activity, notifications or XP, never regenerate an existing
     * slug, and a text-only bot edit does not touch the place's updated_at.
     *
     * @param string|null $id Place primary key.
     *
     * @throws ReflectionException
     * @throws Exception
     *
     * @return ResponseInterface
     */
    public function update($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $input  = $this->request->getJSON();
        $locale = $input?->locale ?? $this->request->getLocale();
        $rules  = [
            'locale'   => 'if_exist|in_list[' . implode(',', config('App')->supportedLocales) . ']',
            'title'    => 'if_exist|required|min_length[8]|max_length[200]',
            'category' => 'if_exist|required|in_list[' . implode(',', config('Categories')->names) . ']',
            'lat'      => 'if_exist|numeric|min_length[3]',
            'lon'      => 'if_exist|numeric|min_length[3]',
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        helper('slug');

        try {
            $placeTags    = new PlaceTags();
            $contentModel = new PlacesContentModel();
            $activity     = new ActivityLibrary();
            $placeData    = $this->model->find($id);
            $placeTexts   = $placeData ? $contentModel->findTexts($id) : [];
            $isBot        = $this->session->user?->role === 'bot';

            if (!$placeData || empty($placeTexts)) {
                return $this->failValidationErrors(lang('Places.updatePointNotExist'));
            }

            // The text being edited is the one in $locale only: never the fallback in another locale
            $currentText = array_values(array_filter($placeTexts, static fn($text) => $text->locale === $locale))[0] ?? null;

            $updatedContent = isset($input->content) ? strip_tags(html_entity_decode($input->content)) : null;
            $updatedTitle   = isset($input->title) ? strip_tags(html_entity_decode($input->title)) : null;

            // A new translation has nothing to keep: what is left out would stay empty
            if (!$currentText && ($updatedContent || $updatedTitle)) {
                $hasOtherContent = !empty(array_filter($placeTexts, static fn($text) => trim((string) $text->content) !== ''));
                $errors          = [];

                if (empty($updatedTitle)) {
                    $errors['title'] = lang('Places.translationTitleRequired');
                }

                if (empty($updatedContent) && $hasOtherContent) {
                    $errors['content'] = lang('Places.translationContentRequired');
                }

                if ($errors) {
                    return $this->failValidationErrors($errors);
                }
            }

            // Save place tags
            $updatedTags = isset($input->tags) ? $placeTags->saveTags($input->tags, $id) : null;

            $shouldRecordActivity = false;

            // Save place content
            if ($updatedContent || $updatedTitle) {
                $placeEntity  = new \App\Entities\PlaceContentEntity();
                $placeEntity->locale   = $locale;
                $placeEntity->place_id = $id;
                $placeEntity->user_id  = $this->session->user?->id;
                $placeEntity->title    = !empty($updatedTitle) ? $updatedTitle : $currentText?->title;
                $placeEntity->content  = !empty($updatedContent) ? $updatedContent : (string) $currentText?->content;

                if ($updatedContent) {
                    $placeEntity->delta = strlen($updatedContent) - strlen((string) $currentText?->content);
                }

                $contentModel->saveContent($placeEntity);

                $shouldRecordActivity = true;
            }

            $place = new PlaceEntity();
            $hasChanges = false;

            $lat = isset($input->lat) ? round($input->lat, 6) : $placeData->lat;
            $lon = isset($input->lon) ? round($input->lon, 6) : $placeData->lon;

            // Check and update coordinates, address and location
            if ($lat !== $placeData->lat || $lon !== $placeData->lon) {
                $geocoder = new Geocoder();
                $geocoded = $geocoder->coordinates($lat, $lon);

                $place->lat = $lat;
                $place->lon = $lon;

                // Only overwrite address/location when geocoding actually
                // succeeded — on failure (e.g. Nominatim down), leave the
                // place's previous address/location fields untouched rather
                // than wiping them with the geocoder's unset null defaults.
                if ($geocoded) {
                    $place->address_ru  = $geocoder->addressRu;
                    $place->address_en  = $geocoder->addressEn;
                    $place->country_id  = $geocoder->countryId;
                    $place->region_id   = $geocoder->regionId;
                    $place->district_id = $geocoder->districtId;
                    $place->locality_id = ($geocoder->localityId > 0) ? $geocoder->localityId : null;
                } else {
                    log_message('warning', 'Places::update geocoding failed for place {id} at {lat},{lon} — keeping its previous address/location.', [
                        'id' => $id, 'lat' => $lat, 'lon' => $lon,
                    ]);
                }

                $hasChanges = true;
                $shouldRecordActivity = true;
            }

            // Change category
            if (isset($input->category)) {
                $place->category = $input->category;
                $hasChanges = true;
                $shouldRecordActivity = true;
            }

            // The slug follows the Russian title, a bot's edit included (the client 301s old URLs);
            // other locales only fill it in when it is missing
            if (!empty($updatedTitle) && ($locale === 'ru' || empty($placeData->slug))) {
                $place->slug = generatePlaceSlug($updatedTitle);
                $hasChanges = true;
            }

            // update() auto-sets updated_at via useTimestamps; touch() handles the case
            // where nothing substantive changed but we still need to record the edit time
            if ($hasChanges) {
                $this->model->update($id, $place);
            } elseif (!$isBot) {
                $this->model->touch($id);
            }

            // Record activity and send notifications once for all edit types; a bot's edits are silent
            if ($shouldRecordActivity && !$isBot) {
                $activity->owner($placeData->user_id)->edit($id);
            }

            $return = [
                'content' => !empty($updatedContent) ? $updatedContent : (string) $currentText?->content,
                'locale'  => $locale,
            ];

            if (isset($input->tags)) {
                $return['tags'] = $updatedTags;
            }

            return $this->respond($return);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Places.createTransactionError'));
        }
    }

    /**
     * Hard-delete a place and all its associated photos and DB records.
     *
     * DELETE /places/:id — admin only.
     * Removes photo files from disk, purges activity/rating/bookmark records via
     * cascading DB deletes, and removes the place itself.
     *
     * @param string|null $id Place primary key.
     *
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user->role !== 'admin') {
            return $this->failUnauthorized();
        }

        if (!$this->model->find($id)) {
            return $this->failNotFound(lang('Places.coverPointNotExist'));
        }

        helper('filesystem');

        // Collections containing this place: captured before the hard delete
        // below cascades away their collections_places rows, so places_count
        // and the indexable flag can be recalculated afterwards.
        $collectionsPlacesModel = new CollectionsPlacesModel();
        $affectedCollectionIds  = $collectionsPlacesModel->collectionIdsForPlace($id);

        (new PlaceTags())->deletePlace($id);

        // Remove all photos
        $photosModel = new PhotosModel();
        $photosModel->where('place_id', $id)->delete(null, true);

        // Remove all files and place directory
        delete_files(UPLOAD_PHOTOS . $id, true);

        // Remove place and all DB entitles such as activity, rating, bookmarks etc.
        $this->model->delete($id, true);

        if (!empty($affectedCollectionIds)) {
            $collectionsModel = new CollectionsModel();
            foreach (array_unique($affectedCollectionIds) as $collectionId) {
                $collectionsModel->recalcPlacesCount($collectionId);
                $collectionsModel->recalcIndexable($collectionId);
            }
        }

        return $this->respondDeleted();
    }

    /**
     * Crop and save a new cover image from a place photo: an uploaded one (photoId) or a linked
     * Wikimedia Commons / PastVu one (externalPhotoId, see PlacesExternalPhotosModel::canBeCover).
     *
     * PATCH /places/cover/:id — auth required.
     * Expects JSON with photoId or externalPhotoId, and the x, y, width, height crop box in the
     * image pixels (of the downloaded file for a linked photo).
     *
     * @param string|null $id Place primary key.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function cover($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $input           = $this->request->getJSON();
        $photoId         = (string) ($input->photoId ?? '');
        $externalPhotoId = (string) ($input->externalPhotoId ?? '');

        if (
            !isset($input->x) || !isset($input->y) || empty($input->width) || empty($input->height)
            || ($photoId === '') === ($externalPhotoId === '')
        ) {
            return $this->failValidationErrors(lang('Places.coverIncorrectData'));
        }

        if ($input->width < PLACE_COVER_MIN_WIDTH || $input->height < PLACE_COVER_MIN_HEIGHT) {
            return $this->failValidationErrors(lang('Places.coverFailDimensions'));
        }

        $crop = [
            'x'      => (int) $input->x,
            'y'      => (int) $input->y,
            'width'  => (int) $input->width,
            'height' => (int) $input->height,
        ];

        $placeData = $this->model->select('id, user_id')->find($id);

        if (!$placeData) {
            return $this->failValidationErrors(lang('Places.coverPointNotExist'));
        }

        $coverLibrary = new PlaceCoverLibrary();

        try {
            if ($externalPhotoId !== '') {
                $row = (new PlacesExternalPhotosModel())->where('place_id', $id)->find($externalPhotoId);

                if (!$row) {
                    return $this->failValidationErrors(lang('Places.coverPointNotExist'));
                }

                if (!PlacesExternalPhotosModel::canBeCover($row)) {
                    return $this->failValidationErrors(lang('Places.coverExternalNotAllowed'));
                }

                $error = $coverLibrary->fromExternal($id, $row, $crop);

                if ($error) {
                    return $this->failValidationErrors(lang($error));
                }
            } else {
                $photoData = (new PhotosModel())->select('id, filename, extension')->find($photoId);

                if (!$photoData) {
                    return $this->failValidationErrors(lang('Places.coverPointNotExist'));
                }

                $imageFile = new File(UPLOAD_PHOTOS . $id . '/' . $photoData->filename . '.' . $photoData->extension);

                list($width, $height) = getimagesize($imageFile->getRealPath());

                $crop = PlaceCoverLibrary::fitCrop($crop, $width, $height);

                if (!$crop) {
                    return $this->failValidationErrors(lang('Places.coverExceedDimensions'));
                }

                $coverLibrary->make($imageFile->getRealPath(), $id, $crop);
                $this->model->update($id, ['cover_external_id' => null]);
            }

            $this->model->touch($id);

            $userActivity = new ActivityLibrary();
            $userActivity->owner($placeData->user_id)->cover($id);

            return $this->respondUpdated();
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Places.createTransactionError'));
        }
    }

    /**
     * Migrate temporary photos to the place's permanent directory and persist records.
     *
     * Called during place creation when the user pre-uploaded photos before the
     * place was saved. Reads each file from UPLOAD_TEMPORARY, saves metadata to
     * the photos table, records activity, and generates the place cover from the
     * first photo.
     *
     * @param array                          $photos  Temporary filenames to process.
     * @param string                         $placeId Newly created place ID.
     * @param \App\Entities\PlaceEntity      $place   Place entity (provides lat/lon).
     * @param \App\Entities\PlaceContentEntity $content Content entity (provides title).
     *
     * @throws ReflectionException
     *
     * @return void
     */
    protected function savePhotos(array $photos, string $placeId, \App\Entities\PlaceEntity $place, \App\Entities\PlaceContentEntity $content): void
    {
        if (empty($photos) || empty($placeId)) {
            return;
        }

        $photoCount   = 0;
        $photoDir     = UPLOAD_PHOTOS . $placeId . '/';
        $photoLibrary = new PhotoLibrary();

        if (!is_dir($photoDir)) {
            mkdir($photoDir, 0777, true);
        }

        foreach ($photos as $photoFile) {
            // Only bare names of files in the temporary directory: a client-sent `../` path
            // would otherwise move another place's photos into this one
            if (!is_string($photoFile) || !preg_match(PhotoLibrary::FILENAME_PATTERN, $photoFile)) {
                continue;
            }

            if (!is_file(UPLOAD_TEMPORARY . $photoFile)) {
                continue;
            }

            $name = pathinfo($photoFile, PATHINFO_FILENAME);
            $ext  = pathinfo($photoFile, PATHINFO_EXTENSION);

            [$width, $height] = getimagesize(UPLOAD_TEMPORARY . $photoFile);

            // GPS position read from the EXIF at upload time (the processed file has none)
            $coordinatesFile = UPLOAD_TEMPORARY . $name . '.json';
            $coordinates     = is_file($coordinatesFile) ? json_decode(file_get_contents($coordinatesFile)) : null;
            PhotoLibrary::removeFile($coordinatesFile);

            $photosModel = new PhotosModel();

            // Save photo to DB
            $photo = new PhotoEntity();
            $photo->lat       = $coordinates?->lat ?? $place->lat;
            $photo->lon       = $coordinates?->lon ?? $place->lon;
            $photo->place_id  = $placeId;
            $photo->user_id   = $this->session->user?->id;
            $photo->title_en  = $content->title;
            $photo->title_ru  = $content->title;
            $photo->filename  = $name;
            $photo->extension = $ext;
            $photo->filesize  = filesize(UPLOAD_TEMPORARY . $photoFile);
            $photo->width     = $width;
            $photo->height    = $height;
            $photosModel->insert($photo);

            $photoId = $photosModel->getInsertID();

            $activity = new ActivityLibrary();
            $activity->photo($photoId, $placeId);

            // If this first uploaded photo - we automated make place cover image
            if ($photoCount === 0) {
                $photoLibrary->generateCover(UPLOAD_TEMPORARY . $photoFile, $photoDir);
            }

            // Move photos
            (new File(UPLOAD_TEMPORARY . $photoFile))->move($photoDir);

            if (is_file(UPLOAD_TEMPORARY . $name . '_preview.' . $ext)) {
                (new File(UPLOAD_TEMPORARY . $name . '_preview.' . $ext))->move($photoDir);
            }

            $photoCount++;
        }

        // Update the time and photos count
        $this->model->update($placeId, ['photos' => $photoCount]);
    }

    /**
     * Apply request-driven filters, sorting, and pagination to a PlacesModel query.
     *
     * Reads sort, order, author, category, country, region, district, locality,
     * limit, offset, and excludePlaces from GET parameters. When $placeIds is
     * non-empty the result set is restricted to those IDs.
     *
     * @param PlacesModel $placesModel The model instance to decorate.
     * @param array       $placeIds   Optional allow-list of place IDs to restrict results.
     *
     * @return PlacesModel The same model instance with all filters applied.
     */
    protected function makeListFilters(PlacesModel $placesModel, array $placeIds = []): PlacesModel
    {
        $orderDefault  = 'DESC';
        $sortingFields = ['views', 'views_week', 'trending', 'recommended', 'rating', 'comments', 'bookmarks', 'category', 'distance', 'created_at', 'updated_at'];
        $orderFields   = ['ASC', 'DESC'];

        $sort     = $this->request->getGet('sort', FILTER_SANITIZE_SPECIAL_CHARS);
        $author   = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS);
        $exclude  = $this->request->getGet('excludePlaces', FILTER_SANITIZE_SPECIAL_CHARS);
        $order    = $this->request->getGet('order', FILTER_SANITIZE_SPECIAL_CHARS) ?? $orderDefault;
        $country  = $this->request->getGet('country', FILTER_SANITIZE_NUMBER_INT);
        $region   = $this->request->getGet('region', FILTER_SANITIZE_NUMBER_INT);
        $district = $this->request->getGet('district', FILTER_SANITIZE_NUMBER_INT);
        $locality = $this->request->getGet('locality', FILTER_SANITIZE_NUMBER_INT);
        $location = $this->request->getGet('location', FILTER_SANITIZE_SPECIAL_CHARS);
        $limit    = abs($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 20);
        $offset   = abs($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0);
        $category = $this->request->getGet('category', FILTER_SANITIZE_SPECIAL_CHARS);
        $missing  = $this->request->getGet('missingLocale', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$this->coordinatesAvailable) {
            $sortingFields = array_diff($sortingFields, ['distance']);
        }

        if ($country) {
            $placesModel->where(['places.country_id' => $country]);
        }

        if ($region) {
            $placesModel->where(['places.region_id' => $region]);
        }

        if ($district) {
            $placesModel->where(['places.district_id' => $district]);
        }

        if ($locality) {
            $placesModel->where(['places.locality_id' => $locality]);
        }

        // Location by slug (/places/{slug}-style landing pages) — in addition
        // to, not instead of, the id-based params above. An unknown slug
        // matches nothing, same as any other filter that found nothing.
        if ($location) {
            $slugRow = (new LocationSlugsModel())->findBySlug($location);
            $column  = $slugRow ? [
                'country'  => 'places.country_id',
                'region'   => 'places.region_id',
                'district' => 'places.district_id',
                'locality' => 'places.locality_id',
            ][$slugRow->type] : null;

            if ($column) {
                $placesModel->where([$column => $slugRow->entity_id]);
            } else {
                $placesModel->where('1 = 0', null, false);
            }
        }

        if ($category) {
            // Comma-separated list (features/20-location-seo-pages.md: "category
            // принимает список через запятую"); a single value still works as before.
            $categories = array_values(array_filter(array_map('trim', explode(',', $category))));

            if (count($categories) > 1) {
                $placesModel->whereIn('places.category', $categories);
            } elseif ($categories) {
                $placesModel->where(['places.category' => $categories[0]]);
            }
        }

        if ($author) {
            $placesModel->where(['places.user_id' => $author]);
        }

        // Places still waiting for a translation into this locale
        if ($missing && in_array($missing, config('App')->supportedLocales, true)) {
            $placesModel->where(
                'NOT EXISTS (SELECT 1 FROM places_content pcm WHERE pcm.place_id = places.id AND pcm.locale = '
                . db_connect()->escape($missing) . ')',
                null,
                false
            );
        }

        // The visitor's own "not been there yet" view: only a signed-in visitor has visits
        if ($this->request->getGet('notVisited') && $this->session->isAuth && $this->session->user) {
            $placesModel->where(
                'NOT EXISTS (SELECT 1 FROM users_visited_places uvp WHERE uvp.place_id = places.id AND uvp.user_id = '
                . db_connect()->escape((string) $this->session->user->id) . ')',
                null,
                false
            );
        }

        if ($exclude) {
            $exclude = explode(',', $exclude);
            $placesModel->whereNotIn('places.id', $exclude);
        }

        if ($placeIds && count($placeIds) >= 1) {
            $placesModel->whereIn('places.id', $placeIds);
        }

        if (in_array($sort, $sortingFields)) {
            $order = in_array($order, $orderFields) ? $order : $orderDefault;

            if ($sort === 'views_week') {
                $placesModel->applyWeeklyViewsSort($order);
            } elseif ($sort === 'trending') {
                $placesModel->orderBy('places.trending_score', $order);
            } elseif ($sort === 'recommended') {
                if ($this->session->isAuth && $this->session->user) {
                    $placesModel->applyRecommendationSort((string) $this->session->user->id);
                } else {
                    // Unauthenticated fallback: use trending score
                    $placesModel->orderBy('places.trending_score', 'DESC');
                }
            } else {
                $sort = $sort === 'updated_at' ? 'places.updated_at' : $sort;
                $sort = $sort === 'created_at' ? 'places.created_at' : $sort;
                $placesModel->orderBy($sort, $order);
            }
        }

        return $placesModel->limit(min($limit, 40), $offset);
    }

    /**
     * Return the list of users who have edited a place, excluding its original author.
     *
     * @param string $placeId       The place ID to look up.
     * @param string $excludeUserId The original author's user ID to exclude.
     *
     * @return array Editor user objects with id, name, and avatar.
     */
    /**
     * Set `bookmarked` and `visited` on each list row for a signed-in visitor: two queries
     * for the whole page instead of one bookmark check per card. Guests get neither field.
     *
     * @param array $placesList Formatted list rows.
     * @param array $placesIds  Their IDs.
     */
    protected function markVisitorState(array $placesList, array $placesIds): void
    {
        if (!$placesIds || !$this->session->isAuth || !$this->session->user) {
            return;
        }

        $userId     = $this->session->user->id;
        $bookmarked = array_flip(array_column(
            (new UsersBookmarksModel())->asArray()->select('place_id')->where('user_id', $userId)->whereIn('place_id', $placesIds)->findAll(),
            'place_id'
        ));
        $visited    = array_flip(array_column(
            (new UsersVisitedPlacesModel())->asArray()->select('place_id')->where('user_id', $userId)->whereIn('place_id', $placesIds)->findAll(),
            'place_id'
        ));

        foreach ($placesList as $place) {
            $place->bookmarked = isset($bookmarked[$place->id]);
            $place->visited    = isset($visited[$place->id]);
        }
    }

    /**
     * A place description as the API returns it: entities decoded, tags stripped.
     * One rule for GET /places/:id and GET /places/:id/texts, so the edit form compares
     * against exactly what it was given.
     */
    protected function plainContent(?string $content): string
    {
        return strip_tags(html_entity_decode((string) $content, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    protected function editors(string $placeId, string $excludeUserId): array
    {
        $model = new ActivityModel();
        $data  = $model->gePlaceEditors($placeId, $excludeUserId);

        if (empty($data)) {
            return [];
        }

        $avatarLibrary = new AvatarLibrary();
        foreach ($data as $user) {
            $user->avatar = $avatarLibrary->buildPath($user->id, $user->avatar, 'small');
        }

        return $data;
    }
}
