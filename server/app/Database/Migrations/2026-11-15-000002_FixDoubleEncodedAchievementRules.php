<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * An award made on the admin page used to store its rules encoded twice (a JSON string holding
 * JSON). The code reads them either way; this makes the rows what they should be: a JSON array.
 * Only a string that is itself valid JSON holding an array is unwrapped.
 *
 * It also drops `achievements.category`: the shelf an award was put on was only informational
 * and nothing reads it any more.
 */
class FixDoubleEncodedAchievementRules extends Migration
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
