<?php namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

class AddVisitVerificationFields extends Migration {
    public function up() {
        $this->forge->addColumn('users_visited_places', [
            'visited_at' => [
                'type'       => 'DATETIME',
                'null'       => false,
                'default'    => date('Y-m-d H:i:s'),
                'after'      => 'place_id',
            ],
            'verified' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
                'after'      => 'visited_at',
            ],
            'lat' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,7',
                'null'       => true,
                'default'    => null,
                'after'      => 'verified',
            ],
            'lon' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,7',
                'null'       => true,
                'default'    => null,
                'after'      => 'lat',
            ],
        ]);

        $this->forge->addColumn('places', [
            'visit_radius_m' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'unsigned'   => true,
                'null'       => false,
                'default'    => 200,
                'after'      => 'updated_at',
            ],
            'verification_exempt' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
                'after'      => 'visit_radius_m',
            ],
        ]);
    }

    public function down() {
        $this->forge->dropColumn('users_visited_places', ['visited_at', 'verified', 'lat', 'lon']);
        $this->forge->dropColumn('places', ['visit_radius_m', 'verification_exempt']);
    }
}
