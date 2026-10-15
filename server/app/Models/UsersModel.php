<?php

namespace App\Models;

use App\Entities\UserEntity;
use App\Libraries\NotificationSettings;
use App\Libraries\OsmScoring;
use CodeIgniter\I18n\Time;
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
     * Finds a user by email, or creates a bare new one if none exists.
     *
     * Used by the passwordless email login flow only. Unlike OAuth's
     * `Auth::serviceAuth()`, this never overwrites an existing user's
     * auth_type — logging in via a magic link must work regardless of which
     * provider an account originally signed up with, and must not clobber
     * that provider's auth_type on subsequent logins. auth_type is only set
     * when the account is created here for the first time.
     *
     * @param string $email    Email address, already validated by the caller.
     * @param string $authType auth_type to assign only if a new user is created.
     * @return array{0: UserEntity, 1: bool} The user, and whether it was just created.
     * @throws ReflectionException
     */
    public function findOrCreateByEmail(string $email, string $authType): array
    {
        $userData = $this->findUserByEmailAddress($email);

        if (!empty($userData)) {
            return [$userData, false];
        }

        $newUser = new UserEntity();
        $newUser->name      = explode('@', $email)[0];
        $newUser->email     = $email;
        $newUser->auth_type = $authType;

        $this->insert($newUser);
        $newUser->id = $this->getInsertID();

        return [$newUser, true];
    }

    /** Smallest move, in metres, that replaces the saved last location (updateLastLocation()). */
    public const LOCATION_MIN_DISTANCE = 200;

    /**
     * Update the activity_at timestamp for a user without altering updated_at.
     *
     * @param string $userId
     * @return void
     */
    public function updateUserActivity(string $userId): void
    {
        $this->db->table($this->table)
            ->where('id', $userId)
            ->update(['activity_at' => Time::now()->toDateTimeString()]);
    }

    /**
     * Save the user's last known position without altering updated_at. The point is kept for
     * future features (the explorer map, features/17-personal-fog-of-war-explorer-map.md) and is
     * never returned by the API. A move shorter than LOCATION_MIN_DISTANCE is ignored.
     *
     * @return bool Whether the position was saved.
     */
    public function updateLastLocation(string $userId, float $lat, float $lon): bool
    {
        $lat  = round($lat, 6);
        $lon  = round($lon, 6);
        $last = $this->db->table($this->table)
            ->select('last_lat, last_lon')
            ->where('id', $userId)
            ->get()
            ->getRow();

        if (!$last) {
            return false;
        }

        if ($last->last_lat !== null && $last->last_lon !== null
            && OsmScoring::distance((float) $last->last_lat, (float) $last->last_lon, $lat, $lon) < self::LOCATION_MIN_DISTANCE
        ) {
            return false;
        }

        $this->db->table($this->table)
            ->where('id', $userId)
            ->update([
                'last_lat'         => $lat,
                'last_lon'         => $lon,
                'last_location_at' => Time::now()->toDateTimeString(),
            ]);

        return true;
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

        if (!$settings || !$data) {
            return $data;
        }

        $data->settings = (new NotificationSettings())->normalize($data->settings ?? null);

        return $data;
    }
}
