<?php

namespace App\Controllers;

use App\Entities\PhotoEntity;
use App\Entities\PlaceEntity;
use App\Libraries\AvatarLibrary;
use App\Libraries\Geocoder;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlaceTags;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Libraries\ActivityLibrary;
use App\Models\ActivityModel;
use App\Models\PhotosModel;
use App\Models\PlacesModel;
use App\Models\PlacesTagsModel;
use App\Models\PlacesContentModel;
use App\Models\TagsModel;
use App\Models\UsersBookmarksModel;
use CodeIgniter\Files\File;
use CodeIgniter\I18n\Time;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Services;
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
     * GET /places — optional query params: sort, order, category, limit, offset,
     * author, country, region, district, locality, search, tag, bookmarkUser,
     * lat, lon, excludePlaces.
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

        $coordinates = $lat && $lon
            ? $this->model->makeDistanceSQL($lat, $lon)
            : $this->model->makeDistanceSQL($this->session->lat, $this->session->lon);

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
            $place->address   = $formatter->formatAddress($place, $locale);
            $place->rating    = (int) $place->rating;
            $place->views     = (int) $place->views;
            $place->photos    = (int) $place->photos;
            $place->comments  = (int) $place->comments;
            $place->bookmarks = (int) $place->bookmarks;
            $place->title     = $placeContent->title($place->id);
            $place->category  = $formatter->formatCategory($place, $locale);
            $place->author    = $formatter->formatAuthor($place);

            if ($coordinates && $place->distance) {
                $place->distance = $formatter->formatDistance($place->distance);
            }

            $cover = $formatter->formatCover($place->id, (int) $place->photos);
            if ($cover) {
                $place->cover = $cover;
            }

            if (!empty($place->updated)) {
                $place->updated = new \DateTime((string) $place->updated);
            }

            $formatter->cleanupFields($place);
        }

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

        $coordinates = $lat && $lon
            ? $this->model->makeDistanceSQL($lat, $lon)
            : $this->model->makeDistanceSQL($this->session->lat, $this->session->lon);

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

        $placeData->category = $formatter->formatCategory($placeData, $locale);

        $cover = $formatter->formatCover($id, (int) $placeData->photos);
        if ($cover) {
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
        $placeData->content = strip_tags(html_entity_decode($placeContent->content($id), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        $placeData->visitRadiusM       = (int) $placeData->visit_radius_m;
        $placeData->verificationExempt = (bool) $placeData->verification_exempt;

        unset($placeData->user_id, $placeData->user_name, $placeData->user_avatar, $placeData->activity_at,
            $placeData->country_id, $placeData->region_id, $placeData->district_id, $placeData->locality_id,
            $placeData->address_en, $placeData->address_ru,
            $placeData->country_en, $placeData->country_ru,
            $placeData->region_en, $placeData->region_ru,
            $placeData->district_en, $placeData->district_ru,
            $placeData->city_en, $placeData->city_ru,
            $placeData->category_en, $placeData->category_ru,
            $placeData->visit_radius_m, $placeData->verification_exempt,
        );

        // Incrementing view counter + daily log (atomic) + optional per-user tracking
        $userId = ($this->session->isAuth && $this->session->user) ? $this->session->user->id : null;
        $this->model->recordView($id, $userId, $placeData->updated);

        return $this->respond($placeData);
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
            'category' => 'required|is_not_unique[category.name]',
            'lat'      => 'numeric|min_length[3]',
            'lon'      => 'numeric|min_length[3]',
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

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

            $placesContentModel->insert($content);

            $activity = new ActivityLibrary();
            $activity->place($newPlaceId);

            if (!empty($input->photos)) {
                $this->savePhotos($input->photos, $newPlaceId, $place, $content);
            }

            $db->transComplete();

            if (!$db->transStatus()) {
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
     * PUT /places/:id — auth required.
     * Manages content versioning: edits within 3 months of the last edit by the
     * same author overwrite the existing version; older edits create a new version.
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

        $locale = $this->request->getLocale();
        $input  = $this->request->getJSON();
        $rules  = [
            'title'    => 'if_exist|required|min_length[8]|max_length[200]',
            'category' => 'if_exist|required|is_not_unique[category.name]',
            'lat'      => 'if_exist|numeric|min_length[3]',
            'lon'      => 'if_exist|numeric|min_length[3]',
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        try {
            $placeTags    = new PlaceTags();
            $placeContent = new PlacesContent();
            $activity     = new ActivityLibrary();
            $placeData    = $this->model->find($id);

            $placeContent->translate([$id]);

            if (!$placeContent->title($id) || !$placeData) {
                return $this->failValidationErrors(lang('Places.updatePointNotExist'));
            }

            // Save place tags
            $updatedTags    = isset($input->tags) ? $placeTags->saveTags($input->tags, $id) : null;
            $updatedContent = isset($input->content) ? strip_tags(html_entity_decode($input->content)) : null;
            $updatedTitle   = isset($input->title) ? strip_tags(html_entity_decode($input->title)) : null;

            // Save place content
            if ($updatedContent || $updatedTitle) {
                $contentModel = new PlacesContentModel();
                $placeEntity  = new \App\Entities\PlaceContentEntity();
                $placeEntity->locale   = $locale;
                $placeEntity->place_id = $id;
                $placeEntity->user_id  = $this->session->user?->id;
                $placeEntity->title    = !empty($updatedTitle) ? $updatedTitle : $placeContent->title($id);
                $placeEntity->content  = !empty($updatedContent) ? $updatedContent : $placeContent->content($id);

                if ($updatedContent) {
                    $placeEntity->delta = strlen($updatedContent) - strlen($placeContent->content($id));
                }

                // If the author of the last edit is the same as the current one,
                // then you need to check when the content was last edited
                if ($placeContent->author($id) === $this->session->user?->id && $placeContent->locale($id) === $locale) {
                    $time = new Time('now');
                    $diff = $time->difference($placeContent->updated($id));

                    // If the last time a user edited this content was less than or equal to 3 months,
                    // then we will simply update the data and will not add a new version
                    if (abs($diff->getMonths()) <= 3) {
                        $contentModel->update($placeContent->id($id), $placeEntity);
                    } else {
                        $contentModel->insert($placeEntity);
                        $activity->owner($placeData->user_id)->edit($id);
                    }
                } else {
                    $contentModel->insert($placeEntity);
                    $activity->owner($placeData->user_id)->edit($id);
                }
            }

            $place = new PlaceEntity();
            $hasChanges = false;

            $lat = isset($input->lat) ? round($input->lat, 6) : $placeData->lat;
            $lon = isset($input->lon) ? round($input->lon, 6) : $placeData->lon;

            // Check and update coordinates, address and location
            if ($lat !== $placeData->lat || $lon !== $placeData->lon) {
                $geocoder = new Geocoder();
                $geocoder->coordinates($lat, $lon);

                $place->lat = $lat;
                $place->lon = $lon;
                $place->address_ru  = $geocoder->addressRu;
                $place->address_en  = $geocoder->addressEn;
                $place->country_id  = $geocoder->countryId;
                $place->region_id   = $geocoder->regionId;
                $place->district_id = $geocoder->districtId;
                $place->locality_id = $geocoder->localityId;
                $hasChanges = true;
            }

            // Change category
            if (isset($input->category)) {
                $place->category = $input->category;
                $hasChanges = true;
            }

            // update() auto-sets updated_at via useTimestamps; touch() handles the case
            // where nothing substantive changed but we still need to record the edit time
            if ($hasChanges) {
                $this->model->update($id, $place);
            } else {
                $this->model->touch($id);
            }

            $return = ['content' => !empty($updatedContent) ? $updatedContent : $placeContent->content($id)];

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

        // Remove all photos
        $photosModel = new PhotosModel();
        $photosModel->where('place_id', $id)->delete(null, true);

        // Remove all files and place directory
        delete_files(UPLOAD_PHOTOS . $id, true);

        // Remove place and all DB entitles such as activity, rating, bookmarks etc.
        $this->model->delete($id, true);

        return $this->respondDeleted();
    }

    /**
     * Crop and save a new cover image from an existing place photo.
     *
     * POST /places/:id/cover — auth required.
     * Expects JSON with photoId, x, y, width, height crop coordinates.
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

        $input = $this->request->getJSON();

        if (!isset($input->x) || !isset($input->y) || !$input->photoId || !$input->width || !$input->height) {
            return $this->failValidationErrors(lang('Places.coverIncorrectData'));
        }

        if ($input->width < PLACE_COVER_WIDTH || $input->height < PLACE_COVER_HEIGHT) {
            return $this->failValidationErrors(lang('Places.coverFailDimensions'));
        }

        $photosModel = new PhotosModel();
        $placeData   = $this->model->select('id, user_id')->find($id);
        $photoData   = $photosModel->select('id, filename, extension')->find($input->photoId);

        if (!$placeData || !$photoData) {
            return $this->failValidationErrors(lang('Places.coverPointNotExist'));
        }

        $photoDir  = UPLOAD_PHOTOS . $id . '/';
        $imageFile = new File($photoDir . $photoData->filename . '.' . $photoData->extension);

        list($width, $height) = getimagesize($imageFile->getRealPath());

        if ($input->width > $width || $input->height > $height) {
            return $this->failValidationErrors(lang('Places.coverExceedDimensions'));
        }

        try {
            $image = Services::image('gd'); // imagick
            $image->withFile($imageFile->getRealPath())
                ->crop($input->width, $input->height, $input->x, $input->y)
                ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
                ->save($photoDir . 'cover.jpg');

            $image->withFile($imageFile->getRealPath())
                ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
                ->save($photoDir . '/cover_preview.jpg');

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
     * @return bool|void False when the photo list is empty; void on success.
     */
    protected function savePhotos(array $photos, string $placeId, \App\Entities\PlaceEntity $place, \App\Entities\PlaceContentEntity $content): bool|null
    {
        if (empty($photos) || empty($placeId)) {
            return false;
        }

        $photoCount = 0;

        if (!is_dir(PATH_PHOTOS . $placeId)) {
            mkdir(PATH_PHOTOS . $placeId,0777, TRUE);
        }

        foreach ($photos as $photoFile) {
            if (!file_exists(UPLOAD_TEMPORARY . $photoFile)) {
                continue;
            }

            $file = new File(UPLOAD_TEMPORARY . $photoFile);
            $name = pathinfo($file, PATHINFO_FILENAME);
            $ext  = $file->getExtension();

            list($width, $height) = getimagesize($file->getRealPath());

            helper('exif');

            $coordinates = getPhotoLocation($file->getRealPath());
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
            $photo->filesize  = $file->getSize();
            $photo->width     = $width;
            $photo->height    = $height;
            $photosModel->insert($photo);

            $photoId = $photosModel->getInsertID();

            $activity = new ActivityLibrary();
            $activity->photo($photoId, $placeId);

            $photoPath = PATH_PHOTOS . $placeId . '/';

            // If this first uploaded photo - we automated make place cover image
            if ($photoCount === 0) {
                $image = Services::image('gd'); // imagick
                $image->withFile($file->getRealPath())
                    ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
                    ->save($photoPath . '/cover.jpg');

                $image->withFile($file->getRealPath())
                    ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
                    ->save($photoPath . '/cover_preview.jpg');
            }

            // Move photos
            $file->move($photoPath);

            $fileName = explode('.', $photoFile);
            $file     = new File(UPLOAD_TEMPORARY . $fileName[0] . '_preview.' . $fileName[1]);
            $file->move($photoPath);

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
        $limit    = abs($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 20);
        $offset   = abs($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0);
        $category = $this->request->getGet('category', FILTER_SANITIZE_SPECIAL_CHARS);

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

        if ($category) {
            $placesModel->where(['places.category' => $category]);
        }

        if ($author) {
            $placesModel->where(['places.user_id' => $author]);
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
