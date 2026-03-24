<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Models\UsersLevelsModel;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

class Levels extends ResourceController
{
    public function __construct()
    {
    }

    /**
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $locale = $this->request->getLocale();
        $awards = (object) [
            'place'   => MODIFIER_PLACE,
            'photo'   => MODIFIER_PHOTO,
            'rating'  => MODIFIER_RATING,
            'cover'   => MODIFIER_COVER,
            'edit'    => MODIFIER_EDIT,
            'comment' => MODIFIER_COMMENT,
        ];

        $levelsModel = new UsersLevelsModel();
        $usersModel  = new UsersModel();
        $levelsData  = $levelsModel->orderBy('level', 'ASC')->findAll();

        if (empty($levelsData)) {
            return $this->respond([
                'awards' => $awards,
                'items'  => []
            ]);
        }

        $result = [];

        // Bulk query 1: get user counts per level
        $db         = \Config\Database::connect();
        $countRows  = $db->query('SELECT level, COUNT(*) as user_count FROM users GROUP BY level')->getResultObject();
        $countByLevel = [];
        foreach ($countRows as $row) {
            $countByLevel[$row->level] = (int) $row->user_count;
        }

        // Bulk query 2: get top 10 users for all levels at once
        $levelNumbers = array_column($levelsData, 'level');
        $topUsersRaw  = $usersModel
            ->select('id, name, avatar, level')
            ->whereIn('level', $levelNumbers)
            ->orderBy('activity_at, updated_at', 'DESC')
            ->findAll();

        // Group top users by level in PHP (keep only first 10 per level)
        $usersByLevel = [];
        foreach ($topUsersRaw as $user) {
            $lvl = $user->level;
            if (!isset($usersByLevel[$lvl])) {
                $usersByLevel[$lvl] = [];
            }
            if (count($usersByLevel[$lvl]) < 10) {
                $usersByLevel[$lvl][] = $user;
            }
        }

        $avatarLibrary = new AvatarLibrary();

        foreach ($levelsData as $level) {
            $data = (object) [];

            $data->experience = $level->experience;
            $data->level = $level->level;
            $data->title = $level->{"title_$locale"};
            $data->count = $countByLevel[$level->level] ?? 0;

            $levelUsers = $usersByLevel[$level->level] ?? [];
            if ($levelUsers) {
                $usersData = [];
                foreach ($levelUsers as $user) {
                    $usersData[] = (object) [
                        'id'     => $user->id,
                        'name'   => $user->name,
                        'avatar' => $avatarLibrary->buildPath($user->id, $user->avatar, 'small'),
                    ];
                }
                $data->users = $usersData;
            }

            $result[] = $data;
        }

        return $this->respond([
            'awards' => $awards,
            'items'  => $result
        ]);
    }
}