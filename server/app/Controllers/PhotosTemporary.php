<?php

namespace App\Controllers;

use App\Entities\PhotoEntity;
use App\Libraries\SessionLibrary;
use CodeIgniter\Files\File;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Services;
use Throwable;

/**
 * This controller is designed to work with temporary photos that are uploaded not to a specific geotag directory,
 * but to a common directory for storing temporary photos.
 *
 * The controller is used when creating a new geotag, when the geotag has not yet been created,
 * but the user is already uploading photos through the interface
 */
class PhotosTemporary extends ResourceController
{

    protected SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
    }

    /**
     * Uploading a temporary photo
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

        if ($photo->hasMoved()) {
            return $this->failValidationErrors($photo->getErrorString());
        }

        try {
            if (!is_dir(UPLOAD_TEMPORARY)) {
                mkdir(UPLOAD_TEMPORARY,0777, TRUE);
            }

            $newName = $photo->getRandomName();
            $photo->move(UPLOAD_TEMPORARY, $newName, true);

            $file = new File(UPLOAD_TEMPORARY . $newName);
            $name = pathinfo($file, PATHINFO_FILENAME);
            $ext = $file->getExtension();

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
                    ->save(UPLOAD_TEMPORARY . $name . '.' . $ext);

                list($width, $height) = getimagesize($file->getRealPath());
            }

            $image = Services::image('gd'); // imagick
            $image->withFile($file->getRealPath())
                ->fit(PHOTO_PREVIEW_WIDTH, PHOTO_PREVIEW_HEIGHT)
                ->save(UPLOAD_TEMPORARY . $name . '_preview.' . $ext);

            $photo = new PhotoEntity();
            $photo->filename  = $name;
            $photo->extension = $ext;
            $photo->width     = $width;
            $photo->height    = $height;

            return $this->respondCreated((object)[
                'id'      => $newName,
                'full'    => PATH_TEMPORARY . $name . '.' . $ext,
                'preview' => PATH_TEMPORARY . $name . '.' . $ext,
                'width'   => $photo->width,
                'height'  => $photo->height,
                'placeId' => 'temporary'
            ]);

        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Photos.uploadError'));
        }
    }

    /**
     * @param null $id
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!file_exists(UPLOAD_TEMPORARY . $id)) {
            return $this->failValidationErrors('Photo not found');
        }

        $originalFile = explode('.', $id);

        unlink(UPLOAD_TEMPORARY . $originalFile[0] . '.' . $originalFile[1]);
        unlink(UPLOAD_TEMPORARY . $originalFile[0] . '_preview.' . $originalFile[1]);

        return $this->respondDeleted(['id' => $id]);
    }

    /**
     * @param $id
     * @return ResponseInterface
     */
    public function rotate($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        if (!file_exists(UPLOAD_TEMPORARY . $id)) {
            return $this->failValidationErrors('Photo not found');
        }

        $originalFile = explode('.', $id);

        $file  = new File(UPLOAD_TEMPORARY . $id);
        $ext   = $file->getExtension();
        $image = Services::image('gd');
        $image->withFile($file->getRealPath())
            ->rotate(270)
            ->save(UPLOAD_TEMPORARY . $originalFile[0] . '.' . $ext);

        $image->withFile(UPLOAD_TEMPORARY . $originalFile[0] . '.' . $ext)
            ->fit(PHOTO_PREVIEW_WIDTH, PHOTO_PREVIEW_HEIGHT)
            ->save(UPLOAD_TEMPORARY . $originalFile[0] . '_preview.' . $ext);

        return $this->respondDeleted([
            'id'      => $id,
            'full'    => PATH_TEMPORARY . $originalFile[0] . '.' . $ext,
            'preview' => PATH_TEMPORARY . $originalFile[0] . '_preview.' . $ext,
        ]);
    }
}