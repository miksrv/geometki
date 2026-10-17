<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * AddActivity (the next migration) links `activity.comment_id` to `comments`, which
 * AddComments creates half a year later: on an empty database MySQL refuses that key.
 * Foreign key checks are off from here to RestoreForeignKeyChecks (right after
 * AddComments), which lets the key wait for its table. On a database that has the
 * tables already both only flip the session setting.
 */
class DeferActivityCommentsForeignKey extends Migration
{
    public function up()
    {
        if ($this->db->DBDriver === 'MySQLi' && !$this->db->tableExists('comments')) {
            $this->db->query('SET FOREIGN_KEY_CHECKS = 0');
        }
    }

    public function down()
    {
    }
}
