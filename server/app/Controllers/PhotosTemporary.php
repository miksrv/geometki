<?php

namespace App\Controllers;

use App\Libraries\PhotoLibrary;
use App\Libraries\SessionLibrary;
use CodeIgniter\Files\File;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Services;
use Throwable;

/**
 * PhotosTemporary controller
 *
 * Handles temporary photo uploads used during new place creation, before the
 * place record exists. Photos are stored in a shared temporary directory and
 * are moved to the place's permanent directory once the place is saved.
 *
 * @package App\Controllers
 */
class PhotosTemporary extends ResourceController
{

    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Upload a photo to the temporary directory.
     *
     * POST /photos/temporary — auth required.
     * Validates MIME type and size, resizes to max dimensions, generates a
     * preview thumbnail, and returns paths for immediate client-side preview.
     *
     * @return ResponseInterface
     */
    public function upload(): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!$photo = $this->request->getFile('photo')) {
            return $this->failValidationErrors('No photo for upload');
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
            if (!is_dir(UPLOAD_TEMPORARY)) {
                mkdir(UPLOAD_TEMPORARY,0777, TRUE);
            }

            $newName = $photo->getRandomName();
            $photo->move(UPLOAD_TEMPORARY, $newName, true);

            $photoLibrary = new PhotoLibrary();
            $processed    = $photoLibrary->processFile(UPLOAD_TEMPORARY . $newName, UPLOAD_TEMPORARY);

            // GD drops the EXIF data, so the photo's GPS position is kept next to the file
            // until the place is created (see Places::savePhotos)
            if ($processed->coordinates) {
                file_put_contents(
                    UPLOAD_TEMPORARY . $processed->name . '.json',
                    json_encode($processed->coordinates)
                );
            }

            return $this->respondCreated((object)[
                'id'      => $newName,
                'full'    => PATH_TEMPORARY . $processed->name . '.' . $processed->ext,
                'preview' => PATH_TEMPORARY . $processed->name . '_preview.' . $processed->ext,
                'width'   => $processed->width,
                'height'  => $processed->height,
                'placeId' => 'temporary'
            ]);

        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Photos.uploadError'));
        }
    }

    /**
     * Delete a temporary photo and its preview from the temporary directory.
     *
     * DELETE /photos/temporary/:id — auth required.
     * Validates that the path stays within the temporary upload directory
     * to prevent path traversal attacks.
     *
     * @param string|null $id Filename of the temporary photo (e.g. abc123.jpg).
     *
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!$this->isValidReference($id)) {
            return $this->failValidationErrors(lang('Photos.temporaryInvalidReference'));
        }

        if (!file_exists(UPLOAD_TEMPORARY . $id)) {
            return $this->failValidationErrors(lang('Photos.temporaryPhotoNotFound'));
        }

        $name = pathinfo($id, PATHINFO_FILENAME);
        $ext  = pathinfo($id, PATHINFO_EXTENSION);

        PhotoLibrary::removeFile(UPLOAD_TEMPORARY . $name . '.' . $ext);
        PhotoLibrary::removeFile(UPLOAD_TEMPORARY . $name . '_preview.' . $ext);
        PhotoLibrary::removeFile(UPLOAD_TEMPORARY . $name . '.json');

        return $this->respondDeleted(['id' => $id]);
    }

    /**
     * Rotate a temporary photo 90° counter-clockwise and regenerate its preview.
     *
     * PUT /photos/temporary/:id/rotate — auth required.
     * Validates that the path stays within the temporary upload directory
     * to prevent path traversal attacks.
     *
     * @param string|null $id Filename of the temporary photo (e.g. abc123.jpg).
     *
     * @return ResponseInterface
     */
    public function rotate($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!$this->isValidReference($id)) {
            return $this->failValidationErrors(lang('Photos.temporaryInvalidReference'));
        }

        if (!file_exists(UPLOAD_TEMPORARY . $id)) {
            return $this->failValidationErrors(lang('Photos.temporaryPhotoNotFound'));
        }

        $originalFile = [pathinfo($id, PATHINFO_FILENAME)];

        $file  = new File(UPLOAD_TEMPORARY . $id);
        $ext   = $file->getExtension();
        $image = Services::image('gd');
        $image->withFile($file->getRealPath())
            ->rotate(270)
            ->save(UPLOAD_TEMPORARY . $originalFile[0] . '.' . $ext);

        $image->withFile(UPLOAD_TEMPORARY . $originalFile[0] . '.' . $ext)
            ->fit(PHOTO_PREVIEW_WIDTH, PHOTO_PREVIEW_HEIGHT)
            ->save(UPLOAD_TEMPORARY . $originalFile[0] . '_preview.' . $ext);

        return $this->respondUpdated([
            'id'      => $id,
            'full'    => PATH_TEMPORARY . $originalFile[0] . '.' . $ext,
            'preview' => PATH_TEMPORARY . $originalFile[0] . '_preview.' . $ext,
        ]);
    }

    /**
     * A temporary photo is referenced by its bare stored file name; anything else (paths,
     * `../`) is rejected so a request can't reach files outside the temporary directory.
     *
     * @param string|null $id Filename of the temporary photo (e.g. 1696000000_abc123.jpg).
     */
    protected function isValidReference(?string $id): bool
    {
        return $id !== null && preg_match(PhotoLibrary::FILENAME_PATTERN, $id) === 1;
    }
}
