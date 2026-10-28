<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use RuntimeException;

/**
 * Tags are removed (features/25-visits-and-exploration.md, step 3): the visit questions and
 * features take over. The tables go, the tag interests of the recommendation profiles too.
 *
 * Refuses to run while the tables still hold rows that were not exported: run
 * `php spark tags:export` first (writable/exports/tags.csv, places_tags.csv), keep the files
 * next to the backup. `down()` recreates the tables empty.
 *
 * The interest profiles lose the `tag` kind and gain `feature` (the `can_*` answers of the
 * visits): `interest_type` is an ENUM, and without this step the driver (strict mode off)
 * would store a `feature` interest as the empty value.
 */
class DropTags extends Migration
{
    public function up()
    {
        // The export must hold every row tags:export takes now (an older export misses the later ones)
        $tables = ['tags' => '', 'places_tags' => ' WHERE deleted_at IS NULL'];

        foreach ($tables as $table => $where) {
            if (!$this->db->tableExists($table)) {
                continue;
            }

            $rows = (int) $this->db->query("SELECT COUNT(*) AS cnt FROM `{$table}`{$where}")->getRow()->cnt;

            if ($rows > 0 && $this->exportedRows(WRITEPATH . "exports/{$table}.csv") !== $rows) {
                throw new RuntimeException("{$table} are not exported: run `php spark tags:export` before this migration");
            }
        }

        $this->db->table('users_interest_profiles')->where('interest_type', 'tag')->delete();
        $this->db->query("ALTER TABLE `users_interest_profiles` MODIFY `interest_type` ENUM('category', 'feature') NOT NULL");

        $this->forge->dropTable('places_tags', true);
        $this->forge->dropTable('tags', true);
    }

    /** The data rows of an export (its header left out), -1 without the file */
    private function exportedRows(string $path): int
    {
        $file = is_file($path) ? fopen($path, 'r') : false;

        if (!$file) {
            return -1;
        }

        $rows = -1;

        while (fgetcsv($file, null, ',', '"', '\\') !== false) {
            $rows++;
        }

        fclose($file);

        return $rows;
    }

    public function down()
    {
        $this->db->table('users_interest_profiles')->where('interest_type', 'feature')->delete();
        $this->db->query("ALTER TABLE `users_interest_profiles` MODIFY `interest_type` ENUM('category', 'tag') NOT NULL");

        if (!$this->db->tableExists('tags')) {
            $this->forge->addField([
                'id'         => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false, 'unique' => true],
                'title_en'   => ['type' => 'VARCHAR', 'constraint' => 40, 'null' => true],
                'title_ru'   => ['type' => 'VARCHAR', 'constraint' => 40, 'null' => true],
                'count'      => ['type' => 'SMALLINT', 'constraint' => 5, 'null' => false, 'default' => 0],
                'created_at DATETIME default current_timestamp',
                'updated_at DATETIME default current_timestamp',
                'deleted_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->createTable('tags');
        }

        if (!$this->db->tableExists('places_tags')) {
            $this->forge->addField([
                'id'         => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false, 'unique' => true],
                'tag_id'     => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'place_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
                'created_at DATETIME default current_timestamp',
                'updated_at DATETIME default current_timestamp',
                'deleted_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addPrimaryKey('id');
            $this->forge->addForeignKey('tag_id', 'tags', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('places_tags');
        }
    }
}
