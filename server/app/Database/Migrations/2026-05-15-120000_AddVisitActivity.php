<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVisitActivity extends Migration {
    public function up()
    {
        $this->db->simpleQuery(
            "ALTER TABLE `activity` MODIFY `type` ENUM('photo','place','rating','edit','cover','comment','visit') NOT NULL"
        );
    }

    public function down()
    {
        $this->db->simpleQuery(
            "ALTER TABLE `activity` MODIFY `type` ENUM('photo','place','rating','edit','cover','comment') NOT NULL"
        );
    }
}
