<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * A season has one picture: the medal of every participant. The places 1–3 get its gold, silver
 * and bronze variants. The separate picture of a season (`game_seasons.image`) goes: where a
 * season has one and no participant's medal, it becomes that medal.
 *
 * Each step checks whether it is still needed, so a run that failed halfway finishes.
 */
class SeasonPictureIsTheMedal extends Migration
{
    public function up()
    {
        if (!$this->db->fieldExists('image', 'game_seasons')) {
            return;
        }

        $this->db->query('UPDATE game_seasons SET medal_participant = image WHERE medal_participant IS NULL AND image IS NOT NULL');
        $this->forge->dropColumn('game_seasons', 'image');
    }

    public function down()
    {
        if ($this->db->fieldExists('image', 'game_seasons')) {
            return;
        }

        $this->forge->addColumn('game_seasons', [
            'image' => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'after' => 'ends_on'],
        ]);
        $this->db->query('UPDATE game_seasons SET image = medal_participant');
    }
}
