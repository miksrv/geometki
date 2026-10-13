<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds the `bot` user role: an account for automated edits (e.g. machine translations of
 * place texts). Its place edits are saved and logged as revisions like anyone else's, but
 * leave no activity, notifications or XP, a text-only edit does not touch the place's
 * updated_at or change its slug (App\Controllers\Places::update()), and the account is
 * left out of the users list and the sitemap.
 */
class AddBotUserRole extends Migration
{
    public function up()
    {
        $this->forge->modifyColumn('users', [
            'role' => [
                'type'    => 'ENUM("user", "moderator", "admin", "bot")',
                'null'    => false,
                'default' => 'user',
            ],
        ]);
    }

    public function down()
    {
        $this->db->table('users')->where('role', 'bot')->update(['role' => 'user']);

        $this->forge->modifyColumn('users', [
            'role' => [
                'type'    => 'ENUM("user", "moderator", "admin")',
                'null'    => false,
                'default' => 'user',
            ],
        ]);
    }
}
