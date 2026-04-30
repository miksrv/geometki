<?php namespace App\Libraries;

use App\Entities\UserEntity;
use App\Entities\UserLevelEntity;
use App\Models\ActivityModel;
use App\Models\UsersLevelsModel;
use App\Models\UsersModel;
use Config\Services;
use ReflectionException;

class LevelsLibrary {
    private array $userLevels;

    public object $statistic;

    private array $types = ['place', 'photo', 'rating', 'edit', 'cover', 'comment'];


    public function __construct() {
        $userLevelsModel  = new UsersLevelsModel();
        $this->userLevels = $userLevelsModel->orderBy('experience')->findAll();
    }

    /**
     * The method starts recalculating the user's experience and returns experience and level.
     * If there is a discrepancy between the current experience or level - updates the user in the database.
     *
     * The method is used when changing the gradation of levels (when you need to recalculate the levels of all users)
     * Or when the user adds/edits material
     * @return $this
     * @throws ReflectionException
     */
    public function calculate(UserEntity $user): static {
        $activityModel = new ActivityModel();
        $activityData  = $activityModel
            ->select('type, COUNT(*) as cnt')
            ->where('user_id', $user->id)
            ->groupBy('type')
            ->findAll();

        $statistic = (object) [
            'place'   => 0,
            'photo'   => 0,
            'rating'  => 0,
            'edit'    => 0,
            'cover'   => 0,
            'comment' => 0
        ];

        if ($activityData) {
            foreach ($activityData as $activity) {
                if (isset($statistic->{$activity->type})) {
                    $statistic->{$activity->type} = (int) $activity->cnt;
                }
            }
        }

        // CALCULATE USER EXPERIENCE
        $experience = 0;
        $experience += $statistic->place * MODIFIER_PLACE;
        $experience += $statistic->photo * MODIFIER_PHOTO;
        $experience += $statistic->rating * MODIFIER_RATING;
        $experience += $statistic->edit * MODIFIER_EDIT;
        $experience += $statistic->cover * MODIFIER_COVER;
        $experience += $statistic->comment * MODIFIER_COMMENT;

        // Add XP bonuses from earned achievements (only current tier per group)
        $db  = \Config\Database::connect();
        $row = $db->query(
            'SELECT COALESCE(SUM(a.xp_bonus), 0) AS achievement_xp
             FROM users_achievements ua
             JOIN achievements a ON a.id = ua.achievement_id
             WHERE ua.user_id = ?',
            [$user->id]
        )->getRow();
        $experience += (int) ($row->achievement_xp ?? 0);

        $this->statistic = $statistic;

        // Let's see what level the user should actually have
        $calcLevel = $this->getUserLevel($experience);

        // If we consider that the user’s actual experience or level does not correspond to that obtained
        // as a result of the calculation, then we will update the user data in the database
        if ($experience !== (int) $user->experience || $calcLevel->level !== (int) $user->level) {
            $userModel = new UsersModel();
            $userModel->update($user->id, ['level' => $calcLevel->level, 'experience' => $experience]);

             if ($calcLevel->level > (int) $user->level) {
                 $notify = new NotifyLibrary();
                 $notify->push('level', $user->id, null, $calcLevel);
             }
        }

        return $this;
    }

    /**
     * NEW MAIN FUNCTION
     *
     * @param string $type
     * @param string $userId
     * @param string $activity
     * @throws ReflectionException
     */
    public function push(string $type, string $userId, string $activity): void {
        $userModel  = new UsersModel();
        $userData   = $userModel->select('id, experience, level')->find($userId);

        if (!in_array($type, $this->types) || !$userId || !$userData) {
            return ;
        }

        $experience = 0;

        switch ($type) {
            case 'place' :
                $experience = MODIFIER_PLACE;
                break;

            case 'photo' :
                $experience = MODIFIER_PHOTO;
                break;

            case 'rating' :
                $experience = MODIFIER_RATING;
                break;

            case 'edit' :
                $experience = MODIFIER_EDIT;
                break;

            case 'cover' :
                $experience = MODIFIER_COVER;
                break;

            case 'comment' :
                $experience = MODIFIER_COMMENT;
                break;
        }

        $userData->experience += $experience;

        $calcLevel = $this->getUserLevel($userData->experience);
        $notify    = new NotifyLibrary();

        if ($calcLevel->level !== (int) $userData->level) {
            $notify->push('level', $userId, $activity, $calcLevel);
            $userModel->update($userData->id, ['level' => $calcLevel->level, 'experience' => $userData->experience]);
        } else {
            $notify->push('experience', $userId, $activity, ['value' => $experience]);
            $userModel->update($userData->id, ['experience' => $userData->experience]);
        }
    }


    /**
     * We simply find the current user level in the database and return it, no calculations required
     * @param UserEntity $user
     * @return UserLevelEntity|null
     */
    public function getLevelData(UserEntity $user): ?object {
        $request    = Services::request();
        $levelIndex = array_search((int) $user->level, array_column($this->userLevels, 'level'));

        if ($levelIndex === false) {
            return null;
        }

        if (isset($this->userLevels[$levelIndex + 1])) {
            $this->userLevels[$levelIndex]->nextLevel = $this->userLevels[$levelIndex + 1]->experience;
        }

        $this->userLevels[$levelIndex]->experience = $user->experience;

        $locale = $request->getLocale();
        $result = clone $this->userLevels[$levelIndex];
        $result->title = $result->{"title_$locale"};

        unset($result->title_en, $result->title_ru);

        return $result;
    }

    protected function getUserLevel(int $experience): UserLevelEntity {
        $request = Services::request();
        $level   = $this->_findUserLevel($experience);
        $locale  = $request->getLocale();
        $result  = clone $level;
        $result->title = $result->{"title_$locale"};

        unset($result->title_en, $result->title_ru);

        return $result;
    }

    /**
     * We find the current level by the amount of user experience
     * @param int $experience
     * @return UserLevelEntity
     */
    protected function _findUserLevel(int $experience): UserLevelEntity {
        // If the experience is zero, then we immediately return the very first level (they are sorted by experience)
        if ($experience === 0) {
            return $this->userLevels[0];
        }

        foreach ($this->userLevels as $key => $level) {
            $nextKey = $key + 1;

            if (
                $nextKey !== count($this->userLevels) &&
                $experience >= $level->experience &&
                $experience < $this->userLevels[$nextKey]->experience
            ) {
                return $level;
            }

            // Reached the last level
            if ($nextKey === count($this->userLevels)) {
                return $level;
            }
        }

        // In all other cases, return the first level
        return $this->userLevels[0];
    }

}
