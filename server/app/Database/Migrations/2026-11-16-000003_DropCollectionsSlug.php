<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * A collection's slug is made from its title on the fly (`generateCollectionSlug()`), like a
 * season's and a quest's: the stored copy goes. Every stored slug matched its title, so no
 * address changes.
 */
class DropCollectionsSlug extends Migration
{
    public function up()
    {
        if ($this->db->fieldExists('slug', 'collections')) {
            $this->forge->dropColumn('collections', 'slug');
        }
    }

    public function down()
    {
        if (!$this->db->fieldExists('slug', 'collections')) {
            $this->forge->addColumn('collections', [
                'slug' => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true, 'after' => 'id'],
            ]);
        }
    }
}
