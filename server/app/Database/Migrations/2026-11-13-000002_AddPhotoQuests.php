<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The photo quest (`quests.mode` = `photos`): a riddle quest whose riddle is the first photo of
 * the point's place instead of a text — the places, the visits and the walk are kept as secret as
 * a riddle's (QuestsModel::SECRET_MODES).
 */
class AddPhotoQuests extends Migration
{
    public function up(): void
    {
        $this->db->query('ALTER TABLE `quests` MODIFY `mode` ENUM("open","steps","riddles","photos") NOT NULL DEFAULT "open"');
    }

    public function down(): void
    {
        $this->db->table('quests')->where('mode', 'photos')->update(['mode' => 'riddles']);
        $this->db->query('ALTER TABLE `quests` MODIFY `mode` ENUM("open","steps","riddles") NOT NULL DEFAULT "open"');
    }
}
