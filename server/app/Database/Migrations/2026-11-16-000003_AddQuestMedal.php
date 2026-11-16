<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The medal of a quest: one picture (PNG or SVG, a hexagon like every award) that the people
 * who walked it to the end wear on their profile. Without it the profile draws the hexagon
 * around the cover of the quest's first point.
 */
class AddQuestMedal extends Migration
{
    public function up(): void
    {
        if (!$this->db->fieldExists('medal', 'quests')) {
            $this->forge->addColumn('quests', [
                'medal' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'description_en'],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->fieldExists('medal', 'quests')) {
            $this->forge->dropColumn('quests', 'medal');
        }
    }
}
