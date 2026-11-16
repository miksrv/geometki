<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * An award made on the admin page used to store its rules encoded twice (a JSON string holding
 * JSON). The code reads them either way; this makes the rows what they should be: a JSON array.
 * Only a string that is itself valid JSON holding an array is unwrapped.
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
    }

    public function down()
    {
        // The fixed rows stay fixed: the old double encoding was a bug
    }
}
