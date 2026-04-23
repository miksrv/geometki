<?php

namespace App\Controllers;

use App\Entities\PhotoEntity;
use App\Libraries\AvatarLibrary;
use App\Libraries\LevelsLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Libraries\ActivityLibrary;
use App\Models\PhotosModel;
use App\Models\PlacesModel;
use App\Models\UsersModel;
use CodeIgniter\Files\File;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Services;
use ReflectionException;
use Throwable;

/**
 * Photos controller
 *
 * Manages place photo uploads, deletion, rotation, and paginated listing.
 * Automatically generates preview images and a place cover on first upload.
 *
 * @package App\Controllers
 */
class Photos extends ResourceController
{

    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Return a paginated list of photos, optionally filtered by author or place.
     *
     * GET /photos — optional query params: author, place, limit, offset.
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $locale = $this->request->getLocale();
        $limit  = abs($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 40);
        $offset = abs($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0);

        $photosData = $this->makeListFilters()->orderBy('photos.created_at')->findAll(min($limit, 40), $offset);

        if (empty($photosData)) {
            return $this->respond([
                'items' => $photosData,
                'count' => 0
            ]);
        }

        $avatarLibrary = new AvatarLibrary();
        foreach ($photosData as $photo) {
            $path  = PATH_PHOTOS . $photo->place_id . '/' . $photo->filename;
            $title = $locale === 'ru' ?
                ($photo->title_ru ?: $photo->title_en) :
                ($photo->title_en ?: $photo->title_ru);

            $photo->title   = $title;
            $photo->placeId = $photo->place_id;
            $photo->full    = $path . '.' . $photo->extension;
            $photo->preview = $path . '_preview.' . $photo->extension;

            if ($photo->user_id) {
                $photo->author = [
                    'id'     => $photo->user_id,
                    'name'   => $photo->user_name,
                    'avatar' => $avatarLibrary->buildPath($photo->user_id, $photo->user_avatar, 'small'),
                ];
            }

            unset(
                $photo->place_id, $photo->title_ru, $photo->title_en, $photo->extension, $photo->filename,
                $photo->user_id, $photo->user_avatar, $photo->user_name,
            );
        }

        return $this->respond([
            'items' => $photosData,
            'count' => $this->makeListFilters()->countAllResults()
        ]);
    }

    /**
     * Upload a photo and attach it to a place.
     *
     * POST /photos/upload/:id — auth required.
     * Validates MIME type and size, resizes to max dimensions, generates a
     * preview thumbnail, and creates the place cover when this is the first photo.
     *
     * @param int|string|null $id Place primary key.
     *
     * @return ResponseInterface
     */
    public function upload($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!$photo = $this->request->getFile('photo')) {
            return $this->failValidationErrors(lang('Photos.noPhotoForUpload'));
        }

        $placesModel = new PlacesModel();
        $placesData  = $placesModel->select('id, lat, lon, photos, user_id')->find($id);

        $placeContent = new PlacesContent();
        $placeContent->translate([$id]);

        if (!$placesData || !$placesData->id) {
            return $this->failValidationErrors(lang('Photos.placeNotFound'));
        }

        if (!$this->validate([
            'photo' => 'uploaded[photo]|mime_in[photo,image/jpeg,image/png,image/webp,image/gif]|max_size[photo,10240]'
        ])) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        if ($photo->hasMoved()) {
            return $this->failValidationErrors($photo->getErrorString());
        }

        try {
            $photoDir = UPLOAD_PHOTOS . $placesData->id . '/';
            $newName = $photo->getRandomName();
            $photo->move($photoDir, $newName, true);

            $file = new File($photoDir . $newName);
            $name = pathinfo($file, PATHINFO_FILENAME);
            $ext  = $file->getExtension();

            list($width, $height) = getimagesize($file->getRealPath());

            // Calculating Aspect Ratio
            $orientation = $width > $height ? 'h' : 'v';
            $width = $orientation === 'h' ? $width : $height;
            $height = $orientation === 'h' ? $height : $width;

            // If the uploaded image dimensions exceed the maximum
            if ($width > PHOTO_MAX_WIDTH || $height > PHOTO_MAX_HEIGHT) {
                $image = Services::image('gd');
                $image->withFile($file->getRealPath())
                    ->fit(PHOTO_MAX_WIDTH, PHOTO_MAX_HEIGHT)
                    ->reorient(true)
                    ->save($photoDir . $name . '.' . $ext);

                list($width, $height) = getimagesize($file->getRealPath());
            }

            $image = Services::image('gd'); // imagick
            $image->withFile($file->getRealPath())
                ->fit(PHOTO_PREVIEW_WIDTH, PHOTO_PREVIEW_HEIGHT)
                ->save($photoDir . $name . '_preview.' . $ext);

            // If this first uploaded photo - we automated make place cover image
            if ($placesData->photos === 0) {
                $image->withFile($file->getRealPath())
                    ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
                    ->save($photoDir . '/cover.jpg');

                $image->withFile($file->getRealPath())
                    ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
                    ->save($photoDir . '/cover_preview.jpg');
            }

            helper('exif');

            $coordinates = getPhotoLocation($file->getRealPath());
            $photosModel = new PhotosModel();

            // Save photo to DB
            $photo = new PhotoEntity();
            $photo->lat       = $coordinates?->lat ?? $placesData->lat;
            $photo->lon       = $coordinates?->lon ?? $placesData->lon;
            $photo->place_id  = $placesData->id;
            $photo->user_id   = $this->session->user?->id;
            $photo->title_en  = $placeContent->title($id);
            $photo->title_ru  = $placeContent->title($id);
            $photo->filename  = $name;
            $photo->extension = $ext;
            $photo->filesize  = $file->getSize();
            $photo->width     = $width;
            $photo->height    = $height;
            $photosModel->insert($photo);

            $photoId = $photosModel->getInsertID();

            $activity = new ActivityLibrary();
            $activity->owner($placesData->user_id)->photo($photoId, $placesData->id);

            // Update the time and photos count
            $placesModel->update($id, ['photos' => $placesData->photos + 1]);

            $photoPath = PATH_PHOTOS . $placesData->id . '/';

            return $this->respondCreated((object)[
                'id'      => $photoId,
                'full'    => $photoPath . $name . '.' . $ext,
                'preview' => $photoPath . $name . '_preview.' . $ext,
                'width'   => $photo->width,
                'height'  => $photo->height,
                'title'   => $photo->title_en ?: $photo->title_ru,
                'placeId' => $photo->place_id
            ]);

        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Photos.uploadError'));
        }
    }

    /**
     * Delete a photo and remove its files from disk.
     *
     * DELETE /photos/:id — auth required (owner or admin).
     * Removes the cover images when this was the only photo of the place.
     *
     * @param int|string|null $id Photo primary key.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $photosModel = new PhotosModel();
        $photoData   = $photosModel->select('id, user_id, place_id, filename, extension')->find($id);

        if (!$photoData) {
            return $this->failValidationErrors(lang('Photos.noPhotoFound'));
        }

        if ($photoData->user_id !== $this->session->user?->id && $this->session->user->role !== 'admin') {
            return $this->failValidationErrors(lang('Photos.noAccessForDelete'));
        }

        $placesModel = new PlacesModel();
        $placesData  = $placesModel->select('id, photos')->find($photoData->place_id);

        if (!$photosModel->delete($id, true)) {
            return $this->failServerError(lang('Photos.deleteError'));
        }

        unlink(UPLOAD_PHOTOS . $photoData->place_id . '/' . $photoData->filename . '.' . $photoData->extension);
        unlink(UPLOAD_PHOTOS . $photoData->place_id . '/' . $photoData->filename . '_preview.' . $photoData->extension);

        // If this was last photo of place - we need to remove place cover files
        if ($placesData->photos === 1) {
            unlink(UPLOAD_PHOTOS . $photoData->place_id . '/cover.jpg');
            unlink(UPLOAD_PHOTOS . $photoData->place_id . '/cover_preview.jpg');
        }

        $userModel  = new UsersModel();
        $userLevels = new LevelsLibrary();
        $userLevels->calculate($userModel->getUserById($photoData->user_id));

        // Update photos count on the current place
        $countPhotos = $photosModel->select('id')->where('place_id', $photoData->place_id)->countAllResults();
        $placesModel->update($photoData->place_id, ['photos' => $countPhotos]);

        return $this->respondDeleted(['id' => $id]);
    }

    /**
     * Rotate a photo 90° counter-clockwise and regenerate its preview.
     *
     * PUT /photos/:id/rotate — auth required.
     * Saves the rotated file under a new random name, regenerates the preview,
     * removes the old files from disk, and updates the DB record.
     *
     * @param int|string|null $id Photo primary key.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function rotate($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $photosModel = new PhotosModel();
        $photoData   = $photosModel->select('id, place_id, filename, extension, width, height')->find($id);

        if (!$photoData) {
            return $this->failValidationErrors(lang('Photos.noPhotoFound'));
        }

        $photoDir = UPLOAD_PHOTOS . $photoData->place_id . '/';
        $file  = new File($photoDir . $photoData->filename . '.' . $photoData->extension);
        $image = Services::image('gd');
        $name  = pathinfo($file->getRandomName(), PATHINFO_FILENAME);
        $image->withFile($file->getRealPath())
            ->rotate(270)
            ->save($photoDir . $name . '.' . $photoData->extension);

        $image->withFile($photoDir . $name . '.' . $photoData->extension)
            ->fit(PHOTO_PREVIEW_WIDTH, PHOTO_PREVIEW_HEIGHT)
            ->save($photoDir . $name . '_preview.' . $photoData->extension);

        unlink($photoDir . $photoData->filename . '.' . $photoData->extension);
        unlink($photoDir . $photoData->filename . '_preview.' . $photoData->extension);

        $photosModel->update($id, [
            'filename' => $name,
            'width'    => $photoData->height,
            'height'   => $photoData->width,
        ]);

        $photoPath = PATH_PHOTOS . $photoData->place_id . '/' . $name;

        return $this->respondUpdated([
            'id'      => $id,
            'full'    => $photoPath . '.' . $photoData->extension,
            'preview' => $photoPath . '_preview.' . $photoData->extension,
        ]);
    }

    /**
     * Build a PhotosModel query with the optional author/place filters applied.
     *
     * Reads author and place from GET query parameters. Used both for fetching
     * the paginated photo list and for counting the total matching records.
     *
     * @return PhotosModel Configured model query builder.
     */
    protected function makeListFilters(): PhotosModel
    {
        $author = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS);
        $place  = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS);

        $photosModel = new PhotosModel();
        $photosModel
            ->select(
                'photos.id, photos.place_id, photos.user_id, photos.filename, photos.extension, photos.width, 
                    photos.height, photos.title_ru, photos.title_en, photos.created_at,
                    users.id as user_id, users.name as user_name, users.avatar as user_avatar')
            ->join('users', 'photos.user_id = users.id', 'left');

        if ($place) {
            $photosModel->where(['photos.place_id' => $place]);
        }

        if ($author) {
            $photosModel->where(['photos.user_id' => $author]);
        }

        $photosModel->orderBy('photos.created_at', 'DESC');

        return $photosModel;
    }
}