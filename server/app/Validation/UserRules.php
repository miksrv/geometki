<?php namespace App\Validation;

use App\Libraries\UserName;
use App\Models\UsersModel;
use Exception;

class UserRules {
    /**
     * @param string $str
     * @param string $fields
     * @param array $data
     * @return bool
     */
    public function validateUser(string $str, string $fields, array $data): bool {
        try {
            $userModel = new UsersModel();
            $userData  = $userModel->findUserByEmailAddress($data['email']);

            return password_verify($data['password'], $userData->password);

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * A display name by the rule of App\Libraries\UserName; the value is checked as it will be
     * saved (normalized), the error tells what is wrong with it.
     *
     * @param mixed       $str
     * @param string|null $error
     * @return bool
     */
    public function valid_user_name($str, ?string &$error = null): bool {
        if (!is_string($str)) {
            $error = lang('Users.nameInvalidChars');
            return false;
        }

        $key = UserName::error(UserName::normalize($str));

        if ($key !== null) {
            $error = lang('Users.' . $key, [\Config\Users::NAME_MIN, \Config\Users::NAME_MAX]);
            return false;
        }

        return true;
    }
}
