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

/** OSM Candidates Controller **/
$routes->group('osm-candidates', static function ($routes) {
    $routes->get('/', 'OsmCandidates::list');
    $routes->get('(:alphanum)', 'OsmCandidates::show/$1');
    $routes->patch('(:alphanum)/link', 'OsmCandidates::link/$1');
    $routes->patch('(:alphanum)/unlink', 'OsmCandidates::unlink/$1');
    $routes->patch('(:alphanum)/reject', 'OsmCandidates::reject/$1');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
    $routes->options('(:alphanum)/(:segment)', static function () {});
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

/** External Photos Controller: Wikimedia Commons and PastVu photos linked to places **/
$routes->group('external-photos', static function ($routes) {
    $routes->get('/', 'ExternalPhotos::list');
    $routes->post('/', 'ExternalPhotos::create');
    $routes->delete('(:alphanum)', 'ExternalPhotos::delete/$1');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
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

/** Stats Controller **/
$routes->get('stats', 'Stats::index');
$routes->options('stats', static function () {});

/** Categories Controller **/
$routes->group('categories', static function ($routes) {
    $routes->get('(:segment)/locations', 'Categories::locations/$1');

    $routes->options('(:segment)/locations', static function () {});
});

/** Rating Controller **/
$routes->group('rating', static function ($routes) {
    $routes->get('(:alphanum)', 'Rating::show/$1');
    $routes->put('/', 'Rating::set');

    $routes->options('/', static function () {});
    $routes->options('(:alphanum)', static function () {});
});

/** Activity Controller **/
$routes->group('activity', static function ($routes) {
    $routes->get('/', 'Activity::list');

    $routes->options('/', static function () {});
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
    $routes->post('magic-link', 'Auth::requestMagicLink');
    $routes->post('magic-link/verify', 'Auth::verifyMagicLink');

    $routes->options('(:alphanum)', static function () {});
    // 'magic-link' contains a hyphen, which (:alphanum) does not match.
    $routes->options('magic-link', static function () {});
    $routes->options('magic-link/verify', static function () {});
});

/** Search Controller **/
$routes->group('search', static function ($routes) {
    $routes->get('/', 'Search::index');
    $routes->get('suggest', 'Search::suggest');

    $routes->options('/', static function () {});
    $routes->options('suggest', static function () {});
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

/** Locations Controller — the landing-page API (features/20-location-seo-pages.md) **/
$routes->group('locations', static function ($routes) {
    $routes->get('resolve', 'Locations::resolve');
    $routes->get('(:segment)/(:num)/categories', 'Locations::categories/$1/$2');
    $routes->get('(:segment)/(:num)/children', 'Locations::children/$1/$2');
    $routes->get('(:segment)/(:num)/summary', 'Locations::summary/$1/$2');

    $routes->options('resolve', static function () {});
    $routes->options('(:segment)/(:num)/(:segment)', static function () {});
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
    $routes->get('/', 'Visited::check');
    $routes->get('user/(:alphanum)', 'Visited::user/$1');
    $routes->get('(:alphanum)', 'Visited::place/$1');
    $routes->put('/', 'Visited::set');

    $routes->options('/', static function () {});
    $routes->options('user/(:alphanum)', static function () {});
    $routes->options('(:alphanum)', static function () {});
});

/** Collections Controller **/
$routes->group('collections', static function ($routes) {
    $routes->get('/', 'Collections::list');
    $routes->get('membership', 'Collections::membership');
    $routes->get('(:alphanum)/recommended', 'Collections::recommended/$1');
    $routes->get('(:alphanum)', 'Collections::show/$1');
    $routes->post('/', 'Collections::create');
    $routes->patch('(:alphanum)/moderation', 'Collections::moderation/$1');
    $routes->patch('(:alphanum)/places', 'Collections::updatePlaces/$1');
    $routes->patch('(:alphanum)', 'Collections::update/$1');
    $routes->put('(:alphanum)/places', 'Collections::addPlaces/$1');
    $routes->delete('(:alphanum)/places/(:alphanum)', 'Collections::removePlace/$1/$2');
    $routes->delete('(:alphanum)', 'Collections::delete/$1');

    $routes->options('/', static function () {});
    $routes->options('membership', static function () {});
    $routes->options('(:alphanum)', static function () {});
    $routes->options('(:alphanum)/(:segment)', static function () {});
    $routes->options('(:alphanum)/places/(:alphanum)', static function () {});
});

/** Sitemap Controller **/
$routes->group('sitemap', static function ($routes) {
    $routes->get('/', 'Sitemap::index');

    $routes->options('/', static function () {});
});
