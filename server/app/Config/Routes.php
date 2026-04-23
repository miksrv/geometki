<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */

/** Root - API info endpoint **/
$routes->get('/', static function () {
    return response()->setJSON([
        'name'    => 'Geometki API',
        'version' => '1.0.0',
        'status'  => 'ok'
    ]);
});

/** POI Controller **/
$routes->group('poi', static function ($routes) {
    $routes->get('/', 'Poi::list');
    $routes->get('photos', 'Poi::photos');
    $routes->get('users', 'Poi::users');
    $routes->get('(:alphanum)', 'Poi::show/$1');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
});

/** Places Controller **/
$routes->group('places', static function ($routes) {
    $routes->get('/', 'Places::list');
    $routes->get('(:alphanum)', 'Places::show/$1');
    $routes->post('/', 'Places::create');
    $routes->patch('cover/(:alphanum)', 'Places::cover/$1');
    $routes->patch('(:alphanum)', 'Places::update/$1');
    $routes->delete('(:alphanum)', 'Places::delete/$1');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
    $routes->options('(:alphanum)/(:alphanum)', static function () {});
});

/** Photos Controller **/
$routes->group('photos', static function ($routes) {
    $routes->get('/', 'Photos::list');
    $routes->post('/', 'Photos::create');
    $routes->post('upload/temporary', 'PhotosTemporary::upload');
    $routes->post('upload/(:alphanum)', 'Photos::upload/$1');
    $routes->patch('rotate/temporary/(:any)', 'PhotosTemporary::rotate/$1');
    $routes->patch('rotate/(:alphanum)', 'Photos::rotate/$1');
    $routes->delete('temporary/(:any)', 'PhotosTemporary::delete/$1');
    $routes->delete('(:alphanum)', 'Photos::delete/$1');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
    $routes->options('(:alphanum)/(:any)', static function () {});
    $routes->options('rotate/temporary/(:any)', static function () {});
});

/** Notifications Controller **/
$routes->group('notifications', static function ($routes) {
    $routes->get('updates', 'Notifications::updates');
    $routes->get('list', 'Notifications::list');
    $routes->delete('/', 'Notifications::clear');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
});

/** Comments Controller **/
$routes->group('comments', static function ($routes) {
    $routes->get('/', 'Comments::list');
    $routes->post('/', 'Comments::create');

    $routes->options('/', static function () {});
});

/** Mail Controller **/
$routes->group('mail', static function ($routes) {
    $routes->get('unsubscribe', 'Mail::unsubscribe');

    $routes->options('(:alphanum)', static function () {});
});

/** Categories Controller **/
$routes->group('categories', static function ($routes) {
    $routes->get('/', 'Categories::list');

    $routes->options('/', static function () {});
});

/** Rating Controller **/
$routes->group('rating', static function ($routes) {
    $routes->get('history', 'Rating::history');
    $routes->get('(:alphanum)', 'Rating::show/$1');
    $routes->put('/', 'Rating::set');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
});

/** Activity Controller **/
$routes->group('activity', static function ($routes) {
    $routes->get('/', 'Activity::list');
    $routes->get('(:alphanum)', 'Activity::show/$1');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
});

/** Users Controller **/
$routes->group('users', static function ($routes) {
    $routes->get('/', 'Users::list');
    $routes->get('(:alphanum)/achievements', 'Achievements::userAchievements/$1');
    $routes->get('(:alphanum)', 'Users::show/$1');
    $routes->post('avatar', 'Users::avatar');
    $routes->patch('crop', 'Users::crop');
    $routes->patch('(:alphanum)', 'Users::update/$1');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
    $routes->options('(:alphanum)/(:alphanum)', static function () {});
});

/** Auth Controller **/
$routes->group('auth', static function ($routes) {
    $routes->get('me', 'Auth::me');
    $routes->get('google', 'Auth::google');
    $routes->get('yandex', 'Auth::yandex');
    $routes->get('vk', 'Auth::vk');
    $routes->post('login', 'Auth::login');
    $routes->post('registration', 'Auth::registration');

    $routes->options('(:alphanum)', static function () {});
});

/** Location Controller **/
$routes->group('location', static function ($routes) {
    $routes->get('search', 'Location::search');
    $routes->get('geosearch', 'Location::geoSearch');
    $routes->get('(:num)', 'Location::show/$1');
    $routes->put('/', 'Location::coordinates');

    $routes->options('/', static function () {});
    $routes->options('(:any)', static function () {});
});

/** Levels Controller **/
$routes->group('levels', static function ($routes) {
    $routes->get('/', 'Levels::list');

    $routes->options('/', static function () {});
});

/** SendingMailManage Controller **/
$routes->group('sending-mail', static function ($routes) {
    $routes->get('manage', 'SendingMailManage::index');
    $routes->get('manage/(:segment)', 'SendingMailManage::show/$1');

    $routes->options('manage', static function () {});
    $routes->options('manage/(:segment)', static function () {});
});

/** Achievements Controller **/
$routes->group('achievements', static function ($routes) {
    $routes->get('/', 'Achievements::index');
    $routes->get('progress', 'Achievements::progress');
    $routes->get('manage', 'Achievements::manage');
    $routes->get('(:segment)', 'Achievements::show/$1');
    $routes->post('/', 'Achievements::create');
    $routes->put('(:segment)', 'Achievements::update/$1');
    $routes->delete('(:segment)', 'Achievements::delete/$1');
$routes->post('(:segment)/image', 'Achievements::uploadImage/$1');

    $routes->options('/', static function () {});
    $routes->options('(:segment)', static function () {});
    $routes->options('(:segment)/(:segment)', static function () {});
});

/** Tags Controller **/
$routes->group('tags', static function ($routes) {
    $routes->get('/', 'Tags::list');
    $routes->get('search', 'Tags::search');

    $routes->options('(:alphanum)', static function () {});
});

/** Bookmarks Controller **/
$routes->group('bookmarks', static function ($routes) {
    $routes->get('/', 'Bookmarks::check');
    $routes->put('/', 'Bookmarks::set');

    $routes->options('/', 'Bookmarks');
    $routes->options('(:alphanum)', static function () {});
});

/** Visited Controller **/
$routes->group('visited', static function ($routes) {
    $routes->get('(:alphanum)', 'Visited::place/$1');
    $routes->put('/', 'Visited::set');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
});

/** Sitemap Controller **/
$routes->group('visited', static function ($routes) {
    $routes->get('/', 'Sitemap::index');

    $routes->options('/', static function () {});
});
