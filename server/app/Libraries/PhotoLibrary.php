<?php

namespace App\Libraries;

use Config\Services;

/**
 * Shared processing of uploaded place photos (direct uploads and temporary uploads alike).
 */
class PhotoLibrary
{
    /**
     * Pattern of the stored file names: CI4's `getRandomName()` (`{time}_{hex}.{ext}`).
     * Anything else coming from a client (e.g. `../`) is rejected.
     */
    public const FILENAME_PATTERN = '/^[A-Za-z0-9_]+\.(jpg|jpeg|jpe|png|gif|webp)$/i';

    /**
     * Process an uploaded photo in place: read its GPS position, apply the EXIF orientation,
     * scale it down to the maximum dimensions keeping the aspect ratio, generate a preview,
     * and optionally the place cover.
     *
     * The EXIF data is read first because GD drops it on every save.
     *
     * @param string $sourcePath  Full filesystem path to the already-moved source file.
     * @param string $targetDir   Directory where the preview (and cover) are saved.
     * @param bool   $createCover When true, also generate cover.jpg / cover_preview.jpg.
     *
     * @return object {name: string, ext: string, width: int, height: int, filesize: int, coordinates: ?object}
     */
    public function processFile(string $sourcePath, string $targetDir, bool $createCover = false): object
    {
        helper('exif');

        $name = pathinfo($sourcePath, PATHINFO_FILENAME);
        $ext  = pathinfo($sourcePath, PATHINFO_EXTENSION);

        $coordinates = getPhotoLocation($sourcePath);

        // Phone photos are stored sideways with an orientation flag; GD would ignore the flag
        // in the preview and the cover, so the pixels are turned upright once here
        $image       = Services::image('gd');
        $orientation = $image->withFile($sourcePath)->getEXIF('Orientation', true);

        if ($orientation && (int) $orientation !== 1) {
            $image->reorient(true)->save($sourcePath);
        }

        [$width, $height] = getimagesize($sourcePath);

        // The maximum box follows the photo's orientation: portrait photos are not cropped
        [$maxWidth, $maxHeight] = $width >= $height
            ? [PHOTO_MAX_WIDTH, PHOTO_MAX_HEIGHT]
            : [PHOTO_MAX_HEIGHT, PHOTO_MAX_WIDTH];

        if ($width > $maxWidth || $height > $maxHeight) {
            Services::image('gd')
                ->withFile($sourcePath)
                ->resize($maxWidth, $maxHeight, true)
                ->save($sourcePath);

            [$width, $height] = getimagesize($sourcePath);
        }

        Services::image('gd')
            ->withFile($sourcePath)
            ->fit(PHOTO_PREVIEW_WIDTH, PHOTO_PREVIEW_HEIGHT)
            ->save($targetDir . $name . '_preview.' . $ext);

        if ($createCover) {
            $this->generateCover($sourcePath, $targetDir);
        }

        clearstatcache(true, $sourcePath);

        return (object) [
            'name'        => $name,
            'ext'         => $ext,
            'width'       => $width,
            'height'      => $height,
            'filesize'    => filesize($sourcePath),
            'coordinates' => $coordinates,
        ];
    }

    /**
     * Generate cover.jpg and cover_preview.jpg from a source image.
     *
     * @param string $sourcePath Full filesystem path to the source image.
     * @param string $targetDir  Directory where cover files will be saved.
     */
    public function generateCover(string $sourcePath, string $targetDir): void
    {
        $image = Services::image('gd');
        $image->withFile($sourcePath)
            ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
            ->save(rtrim($targetDir, '/') . '/cover.jpg');

        $image->withFile($sourcePath)
            ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
            ->save(rtrim($targetDir, '/') . '/cover_preview.jpg');
    }

    /**
     * Remove a file if it exists. Missing files are not an error: unlink() on them raises a
     * warning, which CI4 turns into an exception after the DB changes are already made.
     */
    public static function removeFile(string $path): void
    {
        if (is_file($path)) {
            unlink($path);
        }
    }
}
