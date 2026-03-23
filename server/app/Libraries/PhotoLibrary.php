<?php

namespace App\Libraries;

use CodeIgniter\Files\File;
use Config\Services;

class PhotoLibrary
{
    /**
     * Process an uploaded photo file: enforce max dimensions, normalise aspect ratio,
     * generate a preview, and optionally generate cover images.
     *
     * Returns a metadata object with: name, ext, width, height.
     *
     * @param string $sourcePath   Full filesystem path to the already-moved source file.
     * @param string $targetDir    Directory where processed files will live.
     * @param bool   $createCover  When true, also generate cover.jpg / cover_preview.jpg.
     * @return object  {name: string, ext: string, width: int, height: int}
     */
    public function processFile(string $sourcePath, string $targetDir, bool $createCover = false): object
    {
        $file = new File($sourcePath);
        $name = pathinfo($file, PATHINFO_FILENAME);
        $ext  = $file->getExtension();

        list($width, $height) = getimagesize($file->getRealPath());

        // Calculating Aspect Ratio
        $orientation = $width > $height ? 'h' : 'v';
        $width  = $orientation === 'h' ? $width  : $height;
        $height = $orientation === 'h' ? $height : $width;

        // If the uploaded image dimensions exceed the maximum, resize in-place
        if ($width > PHOTO_MAX_WIDTH || $height > PHOTO_MAX_HEIGHT) {
            $image = Services::image('gd');
            $image->withFile($file->getRealPath())
                ->fit(PHOTO_MAX_WIDTH, PHOTO_MAX_HEIGHT)
                ->reorient(true)
                ->save($targetDir . $name . '.' . $ext);

            list($width, $height) = getimagesize($file->getRealPath());
        }

        // Generate preview
        $image = Services::image('gd');
        $image->withFile($file->getRealPath())
            ->fit(PHOTO_PREVIEW_WIDTH, PHOTO_PREVIEW_HEIGHT)
            ->save($targetDir . $name . '_preview.' . $ext);

        if ($createCover) {
            $this->generateCover($file->getRealPath(), $targetDir);
        }

        return (object) [
            'name'   => $name,
            'ext'    => $ext,
            'width'  => $width,
            'height' => $height,
        ];
    }

    /**
     * Generate cover.jpg and cover_preview.jpg from a source image.
     *
     * @param string $sourcePath  Full filesystem path to the source image.
     * @param string $targetDir   Directory where cover files will be saved.
     */
    public function generateCover(string $sourcePath, string $targetDir): void
    {
        $image = Services::image('gd');
        $image->withFile($sourcePath)
            ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
            ->save($targetDir . '/cover.jpg');

        $image->withFile($sourcePath)
            ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
            ->save($targetDir . '/cover_preview.jpg');
    }
}
