<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The answers to the one-tap questions of a visit (features/25-visits-and-exploration.md, step 2):
 * one row per visit and question, the keys and values of `Config\VisitQuestions`. They go with
 * the visit (the key cascades) and feed "How it is now" on the place page, read by
 * `(question, value)` over the visits of a place.
 */
class CreateVisitAnswers extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('visit_answers')) {
            return;
        }

        $this->forge->addField([
            'visit_id'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => false],
            'question'   => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => false],
            'value'      => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => false],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey(['visit_id', 'question']);
        $this->forge->addKey(['question', 'value']);
        $this->forge->addForeignKey('visit_id', 'users_visited_places', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('visit_answers');
    }

    public function down()
    {
        $this->forge->dropTable('visit_answers', true);
    }
}
