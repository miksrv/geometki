<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Foreign key checks back on after AddComments: see DeferActivityCommentsForeignKey.
 */
class RestoreForeignKeyChecks extends Migration
{
    public function up()
    {
        if ($this->db->DBDriver === 'MySQLi') {
            $this->db->query('SET FOREIGN_KEY_CHECKS = 1');
        }
    }

    public function down()
    {
    }
}
