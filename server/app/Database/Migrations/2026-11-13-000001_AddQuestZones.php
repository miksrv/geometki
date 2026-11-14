<?php

namespace App\Database\Migrations;

use App\Libraries\QuestsLibrary;
use CodeIgniter\Database\Migration;

/**
 * The search zone of a quest (`quests.zone_lat`, `zone_lon`, `zone_radius`): a circle that holds
 * every point of the quest, its centre moved off them (QuestsLibrary::zoneOf()). A riddle quest
 * shows it in place of its points — the town and where to look, not the answers. Counted when
 * the points are saved; the quests made before it get theirs here.
 */
class AddQuestZones extends Migration
{
    public function up(): void
    {
        if (!$this->db->fieldExists('zone_radius', 'quests')) {
            $this->forge->addColumn('quests', [
                'zone_lat'    => ['type' => 'DECIMAL', 'constraint' => '10,6', 'null' => true, 'after' => 'length_m'],
                'zone_lon'    => ['type' => 'DECIMAL', 'constraint' => '10,6', 'null' => true, 'after' => 'zone_lat'],
                'zone_radius' => ['type' => 'INT', 'constraint' => 10, 'unsigned' => true, 'null' => true, 'after' => 'zone_lon'],
            ]);
        }

        $library = new QuestsLibrary();

        foreach ($this->db->table('quests')->select('id')->where('zone_radius', null)->get()->getResult() as $quest) {
            $library->updateZone($quest->id);
        }
    }

    public function down(): void
    {
        if ($this->db->fieldExists('zone_radius', 'quests')) {
            $this->forge->dropColumn('quests', ['zone_lat', 'zone_lon', 'zone_radius']);
        }
    }
}
