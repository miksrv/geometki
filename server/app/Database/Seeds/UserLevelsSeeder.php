<?php

namespace App\Database\Seeds;

use App\Models\UsersLevelsModel;
use CodeIgniter\Database\Seeder;

class UserLevelsSeeder extends Seeder {
    private array $insertData = [
        [1,  0,     'Observer',               'Наблюдатель'],
        [2,  75,    'Trainee',                'Стажёр'],
        [3,  150,   'Pathfinder',             'Следопыт'],
        [4,  300,   'Scout',                  'Разведчик'],
        [5,  500,   'Cartographer',           'Картограф'],
        [6,  750,   'Topographer',            'Топограф'],
        [7,  1000,  'Researcher',             'Исследователь'],
        [8,  1350,  'Ethnographer',           'Этнограф'],
        [9,  1750,  'Chronicler',             'Летописец'],
        [10, 2200,  'Annalist',               'Хроникёр'],
        [11, 2800,  'Analyst',                'Аналитик'],
        [12, 3500,  'Navigator',              'Навигатор'],
        [13, 4400,  'Expert',                 'Эксперт'],
        [14, 5400,  'Connoisseur',            'Знаток'],
        [15, 6600,  'Local Historian',        'Краевед'],
        [16, 8000,  'Pathmaster',             'Путеводитель'],
        [17, 9500,  'Academician',            'Академик'],
        [18, 11200, 'Trailblazer',            'Первопроходец'],
        [19, 13000, 'Archivist',              'Архивариус'],
        [20, 15000, 'Professor',              'Профессор'],
        [21, 17200, 'Geographer',             'Географ'],
        [22, 19600, 'Master Cartographer',    'Мастер-картограф'],
        [23, 22200, 'Map Keeper',             'Хранитель карт'],
        [24, 25000, 'Lore Keeper',            'Хранитель знаний'],
        [25, 28000, 'Pioneer',                'Первооткрыватель'],
        [26, 31500, 'Grand Explorer',         'Великий исследователь'],
        [27, 35000, 'Renowned Cartographer',  'Знаменитый картограф'],
        [28, 39000, 'Legendary Traveler',     'Легендарный путешественник'],
        [29, 43000, 'Grand Pioneer',          'Великий первооткрыватель'],
        [30, 47500, 'Legend',                 'Легенда'],
    ];

    public function run(): void
    {
        $userLevelsModel = new UsersLevelsModel();
        $tempInsertData  = [];

        foreach ($this->insertData as $value) {
            $tempInsertData[] = [
                'level'      => $value[0],
                'experience' => $value[1],
                'title_en'   => $value[2],
                'title_ru'   => $value[3],
            ];
        }

        $userLevelsModel->insertBatch($tempInsertData);
    }
}
