<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Collections made simpler:
 *
 *  - `collections.slug` goes: the slug is made from the title on the fly
 *    (`generateCollectionSlug()`), like a season's and a quest's. Every stored slug matched its
 *    title, so no address changes;
 *  - the admin's "hidden" and "featured" switches go: a collection either is or is not. A
 *    hidden collection was seen by its author and the administrators only, so it is deleted
 *    (soft, like any deleted collection) rather than shown to everyone. The index over
 *    `hidden` becomes one over `indexable` and `updated_at`, what the sitemap and the lists
 *    still read.
 *
 * MySQL commits every DDL statement on its own: each step checks whether it is still needed,
 * so running the migration again finishes a run that failed halfway.
 */
class SimplifyCollections extends Migration
{
    public function up()
    {
        if ($this->db->fieldExists('slug', 'collections')) {
            $this->forge->dropColumn('collections', 'slug');
        }

        if ($this->db->fieldExists('hidden', 'collections')) {
            $this->db->query('UPDATE collections SET deleted_at = NOW() WHERE hidden = 1 AND deleted_at IS NULL');

            foreach ($this->indexesWith('hidden') as $index) {
                $this->db->query("ALTER TABLE collections DROP INDEX `{$index}`");
            }

            $this->forge->dropColumn('collections', 'hidden');
            $this->forge->addKey(['indexable', 'updated_at']);
            $this->forge->processIndexes('collections');
        }

        if ($this->db->fieldExists('featured', 'collections')) {
            $this->forge->dropColumn('collections', 'featured');
        }
    }

    public function down()
    {
        $columns = [];

        if (!$this->db->fieldExists('hidden', 'collections')) {
            $columns['hidden'] = ['type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 0, 'after' => 'cover_photo_id'];
        }

        if (!$this->db->fieldExists('featured', 'collections')) {
            $columns['featured'] = ['type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 0, 'after' => 'cover_photo_id'];
        }

        if ($columns) {
            $this->forge->addColumn('collections', $columns);
        }

        if (!$this->db->fieldExists('slug', 'collections')) {
            $this->forge->addColumn('collections', [
                'slug' => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true, 'after' => 'id'],
            ]);
        }
    }

    /** The names of the indexes of `collections` that cover a column */
    private function indexesWith(string $column): array
    {
        $rows = $this->db->query('SHOW INDEX FROM collections WHERE Column_name = ?', [$column])->getResultArray();

        return array_values(array_unique(array_column($rows, 'Key_name')));
    }
}
