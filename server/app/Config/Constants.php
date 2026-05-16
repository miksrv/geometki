<?php

/*
 | --------------------------------------------------------------------
 | App Namespace
 | --------------------------------------------------------------------
 |
 | This defines the default Namespace that is used throughout
 | CodeIgniter to refer to the Application directory. Change
 | this constant to change the namespace that all application
 | classes should use.
 |
 | NOTE: changing this will require manually modifying the
 | existing namespaces of App\* namespaced-classes.
 */
defined('APP_NAMESPACE') || define('APP_NAMESPACE', 'App');

/*
 | --------------------------------------------------------------------------
 | Composer Path
 | --------------------------------------------------------------------------
 |
 | The path that Composer's autoload file is expected to live. By default,
 | the vendor folder is in the Root directory, but you can customize that here.
 */
defined('COMPOSER_PATH') || define('COMPOSER_PATH', ROOTPATH . 'vendor/autoload.php');

/*
 |--------------------------------------------------------------------------
 | Timing Constants
 |--------------------------------------------------------------------------
 |
 | Provide simple ways to work with the myriad of PHP functions that
 | require information to be in seconds.
 */
defined('SECOND') || define('SECOND', 1);
defined('MINUTE') || define('MINUTE', 60);
defined('HOUR')   || define('HOUR', 3600);
defined('DAY')    || define('DAY', 86400);
defined('WEEK')   || define('WEEK', 604800);
defined('MONTH')  || define('MONTH', 2_592_000);
defined('YEAR')   || define('YEAR', 31_536_000);
defined('DECADE') || define('DECADE', 315_360_000);

/*
 | --------------------------------------------------------------------------
 | Exit Status Codes
 | --------------------------------------------------------------------------
 |
 | Used to indicate the conditions under which the script is exit()ing.
 | While there is no universal standard for error codes, there are some
 | broad conventions.  Three such conventions are mentioned below, for
 | those who wish to make use of them.  The CodeIgniter defaults were
 | chosen for the least overlap with these conventions, while still
 | leaving room for others to be defined in future versions and user
 | applications.
 |
 | The three main conventions used for determining exit status codes
 | are as follows:
 |
 |    Standard C/C++ Library (stdlibc):
 |       http://www.gnu.org/software/libc/manual/html_node/Exit-Status.html
 |       (This link also contains other GNU-specific conventions)
 |    BSD sysexits.h:
 |       http://www.gsp.com/cgi-bin/man.cgi?section=3&topic=sysexits
 |    Bash scripting:
 |       http://tldp.org/LDP/abs/html/exitcodes.html
 |
 */
defined('EXIT_SUCCESS')        || define('EXIT_SUCCESS', 0);        // no errors
defined('EXIT_ERROR')          || define('EXIT_ERROR', 1);          // generic error
defined('EXIT_CONFIG')         || define('EXIT_CONFIG', 3);         // configuration error
defined('EXIT_UNKNOWN_FILE')   || define('EXIT_UNKNOWN_FILE', 4);   // file not found
defined('EXIT_UNKNOWN_CLASS')  || define('EXIT_UNKNOWN_CLASS', 5);  // unknown class
defined('EXIT_UNKNOWN_METHOD') || define('EXIT_UNKNOWN_METHOD', 6); // unknown class member
defined('EXIT_USER_INPUT')     || define('EXIT_USER_INPUT', 7);     // invalid user input
defined('EXIT_DATABASE')       || define('EXIT_DATABASE', 8);       // database error
defined('EXIT__AUTO_MIN')      || define('EXIT__AUTO_MIN', 9);      // lowest automatically-assigned error code
defined('EXIT__AUTO_MAX')      || define('EXIT__AUTO_MAX', 125);    // highest automatically-assigned error code

// Absolute uploads path for PHP and API
defined('UPLOADS')        || define('UPLOADS', FCPATH . 'uploads/');
defined('UPLOAD_PHOTOS')  || define('UPLOAD_PHOTOS', UPLOADS . 'places/');
defined('UPLOAD_AVATARS') || define('UPLOAD_AVATARS', UPLOADS . 'users/');
defined('UPLOAD_TEMPORARY') || define('UPLOAD_TEMPORARY', UPLOADS . 'temp/');

// Relative uploads path for web
defined('PATH_PHOTOS') || define('PATH_PHOTOS', 'uploads/places/');
defined('PATH_AVATARS') || define('PATH_AVATARS', 'uploads/users/');
defined('PATH_TEMPORARY') || define('PATH_TEMPORARY', 'uploads/temp/');

// Place cover image sizes
defined('PLACE_COVER_WIDTH') || define('PLACE_COVER_WIDTH', 1024);
defined('PLACE_COVER_HEIGHT') || define('PLACE_COVER_HEIGHT', 300);
defined('PLACE_COVER_PREVIEW_WIDTH') || define('PLACE_COVER_PREVIEW_WIDTH', 680);
defined('PLACE_COVER_PREVIEW_HEIGHT') || define('PLACE_COVER_PREVIEW_HEIGHT', 300);

// PLace photo max images
defined('PHOTO_MAX_WIDTH') || define('PHOTO_MAX_WIDTH', 4048);
defined('PHOTO_MAX_HEIGHT') || define('PHOTO_MAX_HEIGHT', 3036);
defined('PHOTO_PREVIEW_WIDTH') || define('PHOTO_PREVIEW_WIDTH', 700);
defined('PHOTO_PREVIEW_HEIGHT') || define('PHOTO_PREVIEW_HEIGHT', 500);

// Avatar photo max images
defined('AVATAR_MAX_WIDTH') || define('AVATAR_MAX_WIDTH', 4048);
defined('AVATAR_MAX_HEIGHT') || define('AVATAR_MAX_HEIGHT', 3036);
defined('AVATAR_MEDIUM_WIDTH') || define('AVATAR_MEDIUM_WIDTH', 400);
defined('AVATAR_MEDIUM_HEIGHT') || define('AVATAR_MEDIUM_HEIGHT', 400);
defined('AVATAR_SMALL_WIDTH') || define('AVATAR_SMALL_WIDTH', 100);
defined('AVATAR_SMALL_HEIGHT') || define('AVATAR_SMALL_HEIGHT', 100);

const MODIFIER_PLACE = 20;
const MODIFIER_PHOTO = 10;
const MODIFIER_RATING = 1;
const MODIFIER_COVER = 2;
const MODIFIER_EDIT = 5;
const MODIFIER_COMMENT = 5;


const AUTH_TYPE_NATIVE = 'native';
const AUTH_TYPE_GOOGLE = 'google';
const AUTH_TYPE_YANDEX = 'yandex';
const AUTH_TYPE_VK = 'vk';
