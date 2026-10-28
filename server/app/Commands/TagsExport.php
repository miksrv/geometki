<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;

/**
 * Exports the tags before they are dropped (migration DropTags, features/25 step 3):
 * writable/exports/tags.csv (id, title_ru, title_en, count) and places_tags.csv (place_id,
 * tag_id, title_ru). Keep the files next to the database backup.
 *
 *   php spark tags:export
 */
class TagsExport extends BaseCommand
{
    protected $group       = 'tags';
    protected $name        = 'tags:export';
    protected $description = 'Export the tags and their places to writable/exports before the tables are dropped';

    public function run(array $params)
    {
        $db = Database::connect();

        if (!$db->tableExists('tags')) {
            CLI::write('No tags table: nothing to export.');

            return;
        }

        $dir = WRITEPATH . 'exports/';

        if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
            CLI::error("Cannot create {$dir}");

            return;
        }

        $tags = $db->query('SELECT id, title_ru, title_en, count FROM tags ORDER BY count DESC, id')->getResultArray();
        $this->write($dir . 'tags.csv', ['id', 'title_ru', 'title_en', 'count'], $tags);

        $links = $db->query(
            'SELECT pt.place_id, pt.tag_id, t.title_ru
               FROM places_tags pt
               LEFT JOIN tags t ON t.id = pt.tag_id
              WHERE pt.deleted_at IS NULL
              ORDER BY pt.place_id, pt.tag_id'
        )->getResultArray();
        $this->write($dir . 'places_tags.csv', ['place_id', 'tag_id', 'title_ru'], $links);

        CLI::write(count($tags) . ' tags and ' . count($links) . ' links exported to ' . $dir);
    }

    /**
     * @param string[] $columns
     * @param array<int, array<string, mixed>> $rows
     */
    private function write(string $path, array $columns, array $rows): void
    {
        $file = fopen($path, 'w');
        fputcsv($file, $columns, ',', '"', '\\');

        foreach ($rows as $row) {
            fputcsv($file, array_map(static fn ($column) => $row[$column] ?? '', $columns), ',', '"', '\\');
        }

        fclose($file);
    }
}
