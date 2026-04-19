<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RebuildAchievements extends Migration
{
    public function up(): void
    {
        // Drop old tables in FK-safe order
        $this->db->query('DROP TABLE IF EXISTS users_achievements');
        $this->db->query('DROP TABLE IF EXISTS achievements');

        // Create new achievements table
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => false,
            ],
            'group_slug' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'type' => [
                'type'       => 'ENUM("base","seasonal")',
                'null'       => false,
                'default'    => 'base',
            ],
            'tier' => [
                'type'       => 'ENUM("none","bronze","silver","gold")',
                'null'       => false,
                'default'    => 'none',
            ],
            'category' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'title_en' => [
                'type'       => 'VARCHAR',
                'constraint' => 150,
                'null'       => false,
            ],
            'title_ru' => [
                'type'       => 'VARCHAR',
                'constraint' => 150,
                'null'       => false,
            ],
            'description_en' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'description_ru' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'icon' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'image' => [
                'type'       => 'VARCHAR',
                'constraint' => 200,
                'null'       => true,
            ],
            'rules' => [
                'type' => 'JSON',
                'null' => false,
            ],
            'season_start' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'season_end' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'xp_bonus' => [
                'type'       => 'SMALLINT UNSIGNED',
                'null'       => false,
                'default'    => 0,
            ],
            'sort_order' => [
                'type'       => 'SMALLINT UNSIGNED',
                'null'       => false,
                'default'    => 0,
            ],
            'is_active' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 1,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('group_slug');
        $this->forge->createTable('achievements');

        // Create new users_achievements table
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => false,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => false,
            ],
            'achievement_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => false,
            ],
            'earned_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'notified' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
            'emailed' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['user_id', 'achievement_id'], 'uq_user_achievement');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('achievement_id', 'achievements', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('users_achievements');

        // Add progress JSON column separately (CI4 forge JSON default syntax varies)
        $this->db->query("ALTER TABLE users_achievements ADD COLUMN progress JSON NOT NULL DEFAULT (JSON_OBJECT()) AFTER earned_at");
    }

    public function down(): void
    {
        $this->forge->dropTable('users_achievements', true);
        $this->forge->dropTable('achievements', true);
    }
}
