<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The awards (achievements) for the admin's own section:
 *
 *  - the rules of an award made on the old admin page were stored encoded twice (a JSON string
 *    holding JSON). The code reads them either way; this makes the rows what they should be: a
 *    JSON array. Only a string that is itself valid JSON holding an array is unwrapped;
 *  - `achievements.category` goes: the shelf an award was put on was only informational and
 *    nothing reads it any more (a medal is drawn by its group).
 *
 * No award is made here: those are made by hand in the admin.
 */
class ReworkAchievements extends Migration
{
    public function up()
    {
        $rows = $this->db->query("SELECT id, rules FROM achievements WHERE JSON_TYPE(rules) = 'STRING'")->getResult();

        foreach ($rows as $row) {
            // The column hands back the outer JSON: a string literal whose content is the inner JSON
            $inner = json_decode((string) $row->rules, true);
            $list  = is_string($inner) ? json_decode($inner, true) : null;

            if (is_array($list)) {
                $this->db->table('achievements')->where('id', $row->id)->update(['rules' => json_encode($list)]);
            }
        }

        // The column list is cached per connection: asked anew, the answer is the table's own
        $this->db->resetDataCache();

        if ($this->db->fieldExists('category', 'achievements')) {
            $this->forge->dropColumn('achievements', 'category');
        }
    }

    public function down()
    {
        $this->db->resetDataCache();

        if (! $this->db->fieldExists('category', 'achievements')) {
            $this->forge->addColumn('achievements', [
                'category' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => false,
                    'default'    => '',
                    'after'      => 'tier',
                ],
            ]);
        }

        // The fixed rows stay fixed: the old double encoding was a bug
    }
}
