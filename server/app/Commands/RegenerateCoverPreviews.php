<?php

/**
 * Run from CLI:
 *   php spark system:regenerate-cover-previews
 */

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Services;

class RegenerateCoverPreviews extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'system:regenerate-cover-previews';
    protected $description = 'Regenerate cover_preview.jpg for all places using current PLACE_COVER_PREVIEW dimensions';

    public function run(array $params)
    {
        $dirs = glob(UPLOAD_PHOTOS . '*', GLOB_ONLYDIR);

        if (empty($dirs)) {
            CLI::write('No place directories found in ' . UPLOAD_PHOTOS, 'yellow');
            return;
        }

        $total   = count($dirs);
        $success = 0;
        $skipped = 0;
        $failed  = 0;

        CLI::write("Found {$total} place directories. Regenerating cover previews ({$GLOBALS['PLACE_COVER_PREVIEW_WIDTH']}×" . PLACE_COVER_PREVIEW_HEIGHT . "px)...");
        CLI::write(str_repeat('-', 60));

        foreach ($dirs as $dir) {
            $placeId    = basename($dir);
            $coverPath  = $dir . '/cover.jpg';
            $previewPath = $dir . '/cover_preview.jpg';

            if (!file_exists($coverPath)) {
                CLI::write("[SKIP]  {$placeId} — cover.jpg not found", 'yellow');
                $skipped++;
                continue;
            }

            try {
                $image = Services::image('gd');
                $image->withFile($coverPath)
                    ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
                    ->save($previewPath);

                CLI::write("[OK]    {$placeId}", 'green');
                $success++;
            } catch (\Throwable $e) {
                CLI::write("[ERROR] {$placeId} — " . $e->getMessage(), 'red');
                $failed++;
            }
        }

        CLI::write(str_repeat('-', 60));
        CLI::write("Done. Success: {$success} | Skipped: {$skipped} | Failed: {$failed}");
    }
}
