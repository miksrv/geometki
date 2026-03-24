<?php

namespace Config;

use CodeIgniter\Config\BaseService;

/**
 * Services Configuration file.
 *
 * Services are simply other classes/libraries that the system uses
 * to do its job. This is used by CodeIgniter to allow the core of the
 * framework to be swapped out easily without affecting the usage within
 * the rest of your application.
 *
 * This file holds any application-specific services, or service overrides
 * that you might need. An example has been included with the general
 * method format you should use for your service methods. For more examples,
 * see the core Services file at system/Config/Services.php.
 */
class Services extends BaseService
{
    /*
     * public static function example($getShared = true)
     * {
     *     if ($getShared) {
     *         return static::getSharedInstance('example');
     *     }
     *
     *     return new \CodeIgniter\Example();
     * }
     */

    public static function sessionLibrary(bool $getShared = true): \App\Libraries\SessionLibrary
    {
        if ($getShared) {
            return static::getSharedInstance('sessionLibrary');
        }
        return new \App\Libraries\SessionLibrary();
    }

    public static function avatarLibrary(bool $getShared = true): \App\Libraries\AvatarLibrary
    {
        if ($getShared) {
            return static::getSharedInstance('avatarLibrary');
        }
        return new \App\Libraries\AvatarLibrary();
    }

    public static function activityLibrary(bool $getShared = true): \App\Libraries\ActivityLibrary
    {
        if ($getShared) {
            return static::getSharedInstance('activityLibrary');
        }
        return new \App\Libraries\ActivityLibrary();
    }

    public static function levelsLibrary(bool $getShared = true): \App\Libraries\LevelsLibrary
    {
        if ($getShared) {
            return static::getSharedInstance('levelsLibrary');
        }
        return new \App\Libraries\LevelsLibrary();
    }

    public static function getSecretKey(): bool|array|string {
        $secret = getenv('auth.token.secret');

        if (empty($secret) || strlen($secret) < 16) {
            log_message('critical', 'JWT secret is not configured or is too short');

            if (ENVIRONMENT === 'production') {
                throw new \RuntimeException('JWT secret must be configured and at least 16 characters');
            }

            $secret = $secret ?: 'dev-only-insecure-secret-key-change-me';
        }

        return $secret;
    }
}
