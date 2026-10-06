<?php

/**
 * Run from CLI:
 *   php spark system:generate-place-slugs
 *   php spark system:generate-place-slugs --force
 *
 * Must be run once after the migration that adds places.slug, to backfill
 * existing rows (new/edited places get their slug set automatically by
 * Places::create()/Places::update()). Safe to re-run: without --force it
 * only fills places where slug is currently NULL or empty.
 */

namespace App\Commands;

use App\Libraries\PlacesContent;
use App\Models\PlacesModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class GeneratePlaceSlugs extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'system:generate-place-slugs';
    protected $description = 'Backfill the slug column for places from their Russian (or latest) title';
    protected $usage       = 'system:generate-place-slugs [--force]';
    protected $options     = [
        '--force' => 'Regenerate the slug for every place, even if one is already set',
    ];

    public function run(array $params)
    {
        helper('slug');

        $force = CLI::getOption('force') !== null;

        $placesModel = new PlacesModel();
        $query       = $placesModel->select('id, slug');

        if (!$force) {
            $query->groupStart()
                ->where('slug', null)
                ->orWhere('slug', '')
                ->groupEnd();
        }

        $places = $query->findAll();

        if (empty($places)) {
            CLI::write('Nothing to do — all places already have a slug.', 'yellow');
            return;
        }

        $placeIds = array_column($places, 'id');

        // One title per place, preferring the Russian locale, falling back to
        // whatever locale is available — same resolution PlacesContent always uses.
        $placeContent = new PlacesContent();
        $placeContent->translate($placeIds);

        $updatedCount = 0;
        $skippedCount = 0;

        foreach ($places as $place) {
            $title = $placeContent->title($place->id);
            $slug  = generatePlaceSlug($title);

            if ($slug === null) {
                $skippedCount++;
                continue;
            }

            $placesModel->update($place->id, ['slug' => $slug]);
            $updatedCount++;
        }

        CLI::write("Updated {$updatedCount} place(s).", 'green');

        if ($skippedCount > 0) {
            CLI::write("Skipped {$skippedCount} place(s) with no usable title.", 'yellow');
        }
    }
}
