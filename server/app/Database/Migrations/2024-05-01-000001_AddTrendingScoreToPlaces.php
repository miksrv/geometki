<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddTrendingScoreToPlaces extends Migration {
    public function up()
    {
        $this->forge->addColumn('places', [
            'trending_score' => [
                'type'       => 'MEDIUMINT',
                'unsigned'   => true,
                'null'       => false,
                'default'    => 0,
                'after'      => 'views',
            ],
        ]);

        $this->db->query('CREATE INDEX idx_trending_score ON places (trending_score)');
    }

    public function down()
    {
        $this->db->query('DROP INDEX idx_trending_score ON places');
        $this->forge->dropColumn('places', 'trending_score');
    }
}
