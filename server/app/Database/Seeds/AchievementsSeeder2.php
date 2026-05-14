<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class AchievementsSeeder2 extends Seeder
{
    public function run(): void
    {
        $now  = date('Y-m-d H:i:s');
        $sort = 50;

        $data = [
            // --- Social ---
            [
                'group_slug'     => 'collector',
                'type'           => 'base',
                'tier'           => 'bronze',
                'category'       => 'social',
                'title_en'       => 'Collector',
                'title_ru'       => 'Коллекционер',
                'description_en' => 'Add 30 bookmarks',
                'description_ru' => 'Добавьте 30 закладок',
                'rules'          => json_encode([['metric' => 'bookmarks_added', 'operator' => '>=', 'value' => 30]]),
                'xp_bonus'       => 30,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'collector',
                'type'           => 'base',
                'tier'           => 'silver',
                'category'       => 'social',
                'title_en'       => 'Collector',
                'title_ru'       => 'Коллекционер',
                'description_en' => 'Add 100 bookmarks',
                'description_ru' => 'Добавьте 100 закладок',
                'rules'          => json_encode([['metric' => 'bookmarks_added', 'operator' => '>=', 'value' => 100]]),
                'xp_bonus'       => 75,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'collector',
                'type'           => 'base',
                'tier'           => 'gold',
                'category'       => 'social',
                'title_en'       => 'Collector',
                'title_ru'       => 'Коллекционер',
                'description_en' => 'Add 300 bookmarks',
                'description_ru' => 'Добавьте 300 закладок',
                'rules'          => json_encode([['metric' => 'bookmarks_added', 'operator' => '>=', 'value' => 300]]),
                'xp_bonus'       => 150,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'commenter',
                'type'           => 'base',
                'tier'           => 'bronze',
                'category'       => 'social',
                'title_en'       => 'Commenter',
                'title_ru'       => 'Комментатор',
                'description_en' => 'Write 10 comments',
                'description_ru' => 'Напишите 10 комментариев',
                'rules'          => json_encode([['metric' => 'comments_written', 'operator' => '>=', 'value' => 10]]),
                'xp_bonus'       => 40,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'commenter',
                'type'           => 'base',
                'tier'           => 'silver',
                'category'       => 'social',
                'title_en'       => 'Commenter',
                'title_ru'       => 'Комментатор',
                'description_en' => 'Write 50 comments',
                'description_ru' => 'Напишите 50 комментариев',
                'rules'          => json_encode([['metric' => 'comments_written', 'operator' => '>=', 'value' => 50]]),
                'xp_bonus'       => 100,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'commenter',
                'type'           => 'base',
                'tier'           => 'gold',
                'category'       => 'social',
                'title_en'       => 'Commenter',
                'title_ru'       => 'Комментатор',
                'description_en' => 'Write 200 comments',
                'description_ru' => 'Напишите 200 комментариев',
                'rules'          => json_encode([['metric' => 'comments_written', 'operator' => '>=', 'value' => 200]]),
                'xp_bonus'       => 200,
                'sort_order'     => ++$sort,
            ],

            // --- Exploration ---
            [
                'group_slug'     => 'wanderer',
                'type'           => 'base',
                'tier'           => 'bronze',
                'category'       => 'exploration',
                'title_en'       => 'Wanderer',
                'title_ru'       => 'Странник',
                'description_en' => 'Visit 25 places',
                'description_ru' => 'Посетите 25 мест',
                'rules'          => json_encode([['metric' => 'places_visited', 'operator' => '>=', 'value' => 25]]),
                'xp_bonus'       => 25,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'wanderer',
                'type'           => 'base',
                'tier'           => 'silver',
                'category'       => 'exploration',
                'title_en'       => 'Wanderer',
                'title_ru'       => 'Странник',
                'description_en' => 'Visit 100 places',
                'description_ru' => 'Посетите 100 мест',
                'rules'          => json_encode([['metric' => 'places_visited', 'operator' => '>=', 'value' => 100]]),
                'xp_bonus'       => 75,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'wanderer',
                'type'           => 'base',
                'tier'           => 'gold',
                'category'       => 'exploration',
                'title_en'       => 'Wanderer',
                'title_ru'       => 'Странник',
                'description_en' => 'Visit 500 places',
                'description_ru' => 'Посетите 500 мест',
                'rules'          => json_encode([['metric' => 'places_visited', 'operator' => '>=', 'value' => 500]]),
                'xp_bonus'       => 150,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'pioneer',
                'type'           => 'base',
                'tier'           => 'none',
                'category'       => 'exploration',
                'title_en'       => 'Pioneer',
                'title_ru'       => 'Первооткрыватель',
                'description_en' => 'Add your first place to the map',
                'description_ru' => 'Добавьте первое место на карту',
                'rules'          => json_encode([['metric' => 'places_created', 'operator' => '>=', 'value' => 1]]),
                'xp_bonus'       => 15,
                'sort_order'     => ++$sort,
            ],
            [
                'group_slug'     => 'scout',
                'type'           => 'base',
                'tier'           => 'none',
                'category'       => 'exploration',
                'title_en'       => 'Scout',
                'title_ru'       => 'Разведчик',
                'description_en' => 'Visit your first place',
                'description_ru' => 'Посетите первое место',
                'rules'          => json_encode([['metric' => 'places_visited', 'operator' => '>=', 'value' => 1]]),
                'xp_bonus'       => 15,
                'sort_order'     => ++$sort,
            ],

            // --- Content ---
            [
                'group_slug'     => 'debut',
                'type'           => 'base',
                'tier'           => 'none',
                'category'       => 'content',
                'title_en'       => 'Debut',
                'title_ru'       => 'Дебют',
                'description_en' => 'Upload your first photo',
                'description_ru' => 'Загрузите первую фотографию',
                'rules'          => json_encode([['metric' => 'photos_uploaded', 'operator' => '>=', 'value' => 1]]),
                'xp_bonus'       => 15,
                'sort_order'     => ++$sort,
            ],
        ];

        foreach ($data as &$row) {
            $row['id']           = substr(md5($row['group_slug'] . '_' . $row['tier']), 0, 12);
            $row['created_at']   = $now;
            $row['updated_at']   = $now;
            $row['is_active']    = 1;
            $row['image']        = null;
            $row['season_start'] = null;
            $row['season_end']   = null;
        }
        unset($row);

        $this->db->table('achievements')->insertBatch($data);
    }
}
