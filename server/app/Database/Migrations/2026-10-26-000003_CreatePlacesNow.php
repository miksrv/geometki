<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * "How it is now" of a place (features/25-visits-and-exploration.md, step 2): per place and
 * answer key (`road`, `can_swim`, …) the latest value from the visits, how many of the
 * answers of the three years up to it agree, and the earlier years as history. Rebuilt by
 * VisitsLibrary::rebuildNow() after every answer, read by the place page, the filters and the
 * recommendations (UserInterestProfilesModel, PlacesModel::applyRecommendationSort()).
 * `source` says where a row came from (`visits` now; OSM or the editor later).
 */
class CreatePlacesNow extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('places_now')) {
            return;
        }

        $this->forge->addField([
            'place_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            'question'   => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => false],
            'value'      => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => false],
            'agree'      => ['type' => 'SMALLINT', 'constraint' => 5, 'unsigned' => true, 'null' => false, 'default' => 1],
            'total'      => ['type' => 'SMALLINT', 'constraint' => 5, 'unsigned' => true, 'null' => false, 'default' => 1],
            'visited_at' => ['type' => 'DATE', 'null' => false],
            'history'    => ['type' => 'JSON', 'null' => true],
            'source'     => ['type' => 'VARCHAR', 'constraint' => 10, 'null' => false, 'default' => 'visits'],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey(['place_id', 'question']);
        $this->forge->addKey(['question', 'value']);
        $this->forge->addForeignKey('place_id', 'places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('places_now');
    }

    public function down()
    {
        $this->forge->dropTable('places_now', true);
    }
}
