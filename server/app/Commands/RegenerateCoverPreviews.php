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
    protected $description = 'Regenerate cover.jpg and cover_preview.jpg for all places using current PLACE_COVER dimensions';

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

        CLI::write("Found {$total} place directories. Regenerating covers (" . PLACE_COVER_WIDTH . 'x' . PLACE_COVER_HEIGHT . 'px) and previews (' . PLACE_COVER_PREVIEW_WIDTH . 'x' . PLACE_COVER_PREVIEW_HEIGHT . "px)...");
        CLI::write(str_repeat('-', 60));

        foreach ($dirs as $dir) {
            $placeId     = basename($dir);
            $coverPath   = $dir . '/cover.jpg';
            $previewPath = $dir . '/cover_preview.jpg';

            // Find the best source: prefer original photos over cover.jpg
            $sourceFile = $this->findOriginalPhoto($dir);

            if ($sourceFile === null) {
                if (!file_exists($coverPath)) {
                    CLI::write("[SKIP]  {$placeId} — no source photo found", 'yellow');
                    $skipped++;
                    continue;
                }
                // Fallback: use existing cover.jpg (may upscale)
                $sourceFile = $coverPath;
            }

            try {
                $image = Services::image('gd');

                $image->withFile($sourceFile)
                    ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
                    ->save($coverPath);

                $image->withFile($sourceFile)
                    ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
                    ->save($previewPath);

                $label = ($sourceFile === $coverPath) ? '(from cover.jpg)' : '(from original)';
                CLI::write("[OK]    {$placeId} {$label}", 'green');
                $success++;
            } catch (\Throwable $e) {
                CLI::write("[ERROR] {$placeId} — " . $e->getMessage(), 'red');
                $failed++;
            }
        }

        CLI::write(str_repeat('-', 60));
        CLI::write("Done. Success: {$success} | Skipped: {$skipped} | Failed: {$failed}");
    }

    /**
     * Returns path to the largest original photo in the directory,
     * excluding cover.jpg and *_preview.* files.
     */
    private function findOriginalPhoto(string $dir): ?string
    {
        $files = glob($dir . '/*.{jpg,jpeg,png}', GLOB_BRACE);
        $best  = null;
        $bestSize = 0;

        foreach ($files as $file) {
            $basename = basename($file);
            if ($basename === 'cover.jpg' || $basename === 'cover_preview.jpg' || str_contains($basename, '_preview.')) {
                continue;
            }

            $size = filesize($file);
            if ($size > $bestSize) {
                $bestSize = $size;
                $best     = $file;
            }
        }

        return $best;
    }
}
