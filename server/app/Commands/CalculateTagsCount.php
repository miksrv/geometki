<?php

/**
 * Run from CLI:
 *   php spark system:calculate-tags-count
 *
 * Add to cron:
 *   * * * * * cd /path/to/server && php spark system:calculate-tags-count >> /dev/null 2>&1
 */

namespace App\Commands;

use App\Models\PlacesTagsModel;
use App\Models\TagsModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class CalculateTagsCount extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'system:calculate-tags-count';
    protected $description = 'Recalculate and update the tag usage counter for all tags';

    public function run(array $params)
    {
        $tagsModel      = new TagsModel();
        $placeTagsModel = new PlacesTagsModel();
        $updatedRows    = 0;

        if ($tagsData = $tagsModel->select('id, count')->findAll()) {
            foreach ($tagsData as $tag) {
                $count = $placeTagsModel->where('tag_id', $tag->id)->countAllResults();

                if ($tag->count !== $count) {
                    $tagsModel->update($tag->id, ['count' => $count]);
                    $updatedRows++;
                }
            }
        }

        CLI::write("Updated {$updatedRows} tag(s).");
    }
}
