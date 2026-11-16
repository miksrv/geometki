<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Seasons made by hand: an administrator gives each season its dates, title, description,
 * picture and four medals (gold, silver, bronze, and the grey one of every other participant).
 * The calendar halves stop being created by themselves.
 *
 * The two seasons that exist already get their titles, so they read like the new ones.
 *
 * MySQL commits every DDL statement on its own: each step checks whether it is still needed,
 * so running the migration again finishes a run that failed halfway.
 */
class ManualSeasons extends Migration
{
    private const COLUMNS = ['title_ru', 'title_en', 'description_ru', 'description_en', 'medal_gold', 'medal_silver', 'medal_bronze', 'medal_participant', 'updated_at'];

    public function up()
    {
        $table = 'game_seasons';

        if (!$this->db->fieldExists('title_ru', $table)) {
            $this->forge->addColumn($table, [
                'title_ru'          => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => false, 'default' => '', 'after' => 'id'],
                'title_en'          => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true, 'after' => 'title_ru'],
                'description_ru'    => ['type' => 'TEXT', 'null' => true, 'after' => 'title_en'],
                'description_en'    => ['type' => 'TEXT', 'null' => true, 'after' => 'description_ru'],
            ]);
        }

        if (!$this->db->fieldExists('medal_gold', $table)) {
            $this->forge->addColumn($table, [
                'medal_gold'        => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'after' => 'image'],
                'medal_silver'      => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'after' => 'medal_gold'],
                'medal_bronze'      => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'after' => 'medal_silver'],
                'medal_participant' => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'after' => 'medal_bronze'],
            ]);
        }

        if (!$this->db->fieldExists('updated_at', $table)) {
            $this->forge->addColumn($table, [
                'updated_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
        }

        if (!$this->db->query("SHOW INDEX FROM {$table} WHERE Key_name = 'game_seasons_dates'")->getRow()) {
            $this->db->query("ALTER TABLE {$table} ADD INDEX game_seasons_dates (starts_on, ends_on)");
        }

        // The calendar seasons made so far (`2026-warm`, `2026-cold`) get the titles the pages used to build
        foreach ($this->db->table($table)->select('id')->where('title_ru', '')->get()->getResult() as $row) {
            if (!preg_match('/^(\d{4})-(warm|cold)$/', $row->id, $match)) {
                continue;
            }

            $year = (int) $match[1];
            $next = substr((string) ($year + 1), 2);

            $this->db->table($table)->where('id', $row->id)->update($match[2] === 'warm'
                ? ['title_ru' => "Тёплый сезон {$year}", 'title_en' => "Warm season {$year}"]
                : ['title_ru' => "Холодный сезон {$year}/{$next}", 'title_en' => "Cold season {$year}/{$next}"]);
        }
    }

    public function down()
    {
        $table = 'game_seasons';

        if ($this->db->query("SHOW INDEX FROM {$table} WHERE Key_name = 'game_seasons_dates'")->getRow()) {
            $this->db->query("ALTER TABLE {$table} DROP INDEX game_seasons_dates");
        }

        foreach (self::COLUMNS as $column) {
            if ($this->db->fieldExists($column, $table)) {
                $this->forge->dropColumn($table, $column);
            }
        }
    }
}
