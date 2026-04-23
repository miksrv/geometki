<?php

namespace App\Models;

use App\Entities\UserEntity;
use CodeIgniter\I18n\Time;
use Exception;
use ReflectionException;

/**
 * Model for the `users` table.
 *
 * Handles user retrieval, authentication lookups, and activity tracking.
 * Soft-deletes are enabled; deleted_at is hidden from output via $hiddenFields.
 *
 * @package App\Models
 */
class UsersModel extends ApplicationBaseModel
{
    protected $table            = 'users';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = UserEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected array $hiddenFields = ['deleted_at'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'name',
        'email',
        'password',
        'role',
        'auth_type',
        'locale',
        'experience',
        'level',
        'avatar',
        'website',
        'reputation',
        'settings',
        'digest_sent_at',
        'activity_at',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
    protected $afterFind      = ['prepareOutput'];

    // -------------------------------------------------------------------------
    // Custom query methods
    // -------------------------------------------------------------------------

    /**
     * Find a user by their e-mail address, selecting only the columns required
     * for authentication flows.
     *
     * @param string $emailAddress
     * @return UserEntity|array|null
     */
    public function findUserByEmailAddress(string $emailAddress): UserEntity|array|null
    {
        return $this
            ->select('id, name, avatar, email, password, auth_type, role, locale, settings, level, experience')
            ->where('email', $emailAddress)
            ->first();
    }

    /**
     * Update the activity_at timestamp for a user without altering updated_at.
     *
     * @param string $userId
     * @return void
     * @throws ReflectionException
     * @throws Exception
     */
    public function updateUserActivity(string $userId): void
    {
        $userData = $this->select('updated_at')->find($userId);

        $user = new UserEntity();
        $user->updated_at  = $userData->updated_at;
        $user->activity_at = Time::now();

        $this->update($userId, $user);
    }

    /**
     * Retrieve a public user profile by ID.
     *
     * Pass $settings = true to include the user's notification preference
     * object with safe defaults applied.
     *
     * @param string $userId
     * @param bool   $settings  Whether to include and normalise the settings column.
     * @return array|object|null
     */
    public function getUserById(string $userId, bool $settings = false): array|object|null
    {
        $settingsCol = $settings ? ', settings' : '';

        $data = $this
            ->select(
                'id, name, email, locale, avatar, created_at as created,
                updated_at as updated, activity_at as activity, level, role,
                auth_type as authType, website, experience, reputation' . $settingsCol
            )
            ->find($userId);

        if (!$settings) {
            return $data;
        }

        $data->settings = (object) [
            'emailComment' => $data->settings->emailComment ?? true,
            'emailEdit'    => $data->settings->emailEdit    ?? true,
            'emailPhoto'   => $data->settings->emailPhoto   ?? true,
            'emailRating'  => $data->settings->emailRating  ?? true,
            'emailCover'   => $data->settings->emailCover   ?? true,
            'emailDigest'  => $data->settings->emailDigest  ?? true,
        ];

        return $data;
    }
}
