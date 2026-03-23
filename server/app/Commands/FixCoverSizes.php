<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Services;

class FixCoverSizes extends BaseCommand
{
    protected $group       = 'migrate';
    protected $name        = 'migrate:fix-cover-sizes';
    protected $description = 'Resize existing cover.jpg files that exceed the maximum cover dimensions';

    public function run(array $params)
    {
        $this->searchImage(UPLOAD_PHOTOS);
        CLI::write('Cover size fix complete.');
    }

    /**
     * Recursively walk $directory and resize any cover.jpg that exceeds the max cover dimensions.
     *
     * @param string $directory
     */
    protected function searchImage(string $directory): void
    {
        $dirHandle = opendir($directory);

        while (($file = readdir($dirHandle)) !== false) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $filePath = $directory . '/' . $file;

            if (is_dir($filePath)) {
                $this->searchImage($filePath);
                continue;
            }

            if (is_file($filePath) && pathinfo($filePath, PATHINFO_FILENAME) === 'cover') {
                list($width, $height) = getimagesize($filePath);

                if ($width > PLACE_COVER_WIDTH && $height > PLACE_COVER_HEIGHT) {
                    $image = Services::image('gd');
                    $image->withFile($filePath)
                        ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
                        ->save($filePath);

                    CLI::write('Resized: ' . $filePath);
                }
            }
        }

        closedir($dirHandle);
    }
}
