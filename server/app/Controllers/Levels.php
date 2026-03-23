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

        foreach ($levelsData as $level) {
            $data = (object) [];

            $data->experience = $level->experience;

            $data->level = $level->level;
            $data->title = $level->{"title_$locale"};
            $data->count = $usersModel->select('id')->where('level', $level->level)->countAllResults();
            $data->users = $usersModel
                ->select('id, name, avatar')
                ->where('level', $level->level)
                ->orderBy('activity_at, updated_at', 'DESC')
                ->findAll(10);

            if ($data->users) {
                $usersData     = [];
                $avatarLibrary = new AvatarLibrary();

                foreach ($data->users as $user) {
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