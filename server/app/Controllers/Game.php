<?php

namespace App\Controllers;

use App\Controllers\Concerns\AdminOnly;
use App\Libraries\AdminImageLibrary;
use App\Libraries\AvatarLibrary;
use App\Libraries\GameLibrary;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\QuestsLibrary;
use App\Libraries\SessionLibrary;
use App\Libraries\VisitsLibrary;
use App\Models\PlacesModel;
use App\Models\VisitsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;
use Config\Game as GameConfig;
use Config\Services;
use Throwable;

/**
 * The game (features/26-game-seasons-and-quests.md): the season, its rating — overall and by
 * location —, the valuable places, the confirmation of a visit by "I am here", a person's
 * explored share of their locations. The quests are in the Quests controller.
 *
 * The answers carry the visitor's own standing, so none of it is in the guest cache.
 *
 * @package App\Controllers
 */
class Game extends ResourceController
{
    use AdminOnly;

    /**
     * Confirmations by a position of a person, over all the places: far more than a day of
     * walking gives, too few for a script that sends the coordinates of every place around
     */
    private const CONFIRMS_PER_MINUTE = 10;
    private const CONFIRMS_PER_HOUR   = 100;
    private const CONFIRMS_PER_DAY    = 300;

    private const LEADERS_DEFAULT = 10;
    private const LEADERS_MAX     = 50;

    private const MINE_DEFAULT = 10;
    private const MINE_MAX     = 50;

    private const PLACES_DEFAULT = 6;
    private const PLACES_MAX     = 24;

    /** How many of the nearest places are weighed to pick the valuable ones */
    private const NEARBY_POOL = 60;

    /** Without a point: how many of the most viewed places are weighed */
    private const EVERYWHERE_POOL = 300;

    /** The widest `radius` of `GET /game/places`, km */
    private const RADIUS_MAX = 500;

    protected SessionLibrary $session;

    protected GameLibrary $game;

    protected GameConfig $config;

    public function __construct()
    {
        $this->session = new SessionLibrary();
        $this->game    = new GameLibrary();
        $this->config  = config(GameConfig::class);
    }

    /**
     * The section "Game": the current season, the public table of points, the visitor's own
     * score, the past seasons.
     *
     * GET /game?rivals=1 → { season, rules, awards, totals, me?, seasons }; with `rivals`,
     * `me.rivals` — the players right above and below the visitor: { above?, below? }
     *
     * @return ResponseInterface
     */
    public function index(): ResponseInterface
    {
        // The season that goes on; between seasons the nearest one to come, or none
        $season = $this->game->current() ?? $this->game->upcoming();
        $today  = GameLibrary::today();
        $db     = Database::connect();
        // A season not begun has no table
        $table  = $season && $season['from'] <= $today ? $this->game->table($season['id']) : [];
        $locale = $this->request->getLocale();

        $answer = [
            'season' => $season ? $this->seasonInfo($season, $locale) : null,
            'rules'  => [
                'base'        => $this->config->base,
                'categories'  => $this->config->categories,
                'order'       => array_map(
                    static fn (int $upTo, float $factor) => ['upTo' => $upTo, 'factor' => $factor],
                    array_keys($this->config->order),
                    array_values($this->config->order)
                ),
                'photoBonus'  => $this->config->photoBonus,
                'spotBonus'   => $this->config->spotBonus,
                'graceDays'   => $this->config->graceDays,
                'radius'      => $this->config->radius,
                'radiuses'    => $this->config->radiuses,
            ],
            // The awards that can be earned only within this season (limited ones, by their dates)
            'awards' => $season ? $this->game->seasonAwards($season, $this->session->user?->id, $locale) : [],
            'totals' => [
                'players' => count($table),
                'places'  => $table ? $this->placesCount($season['id']) : 0,
                'quests'  => $db->table('quests')->where(['status' => 'published', 'deleted_at' => null])->countAllResults(),
            ],
            'seasons' => $this->pastSeasons($locale),
        ];

        if ($this->session->user) {
            $answer['me'] = $this->standing($table, $this->session->user->id);

            // The two next to the visitor in the table, on request (the game's own blocks): whom to
            // catch up with, who is catching up. Someone without geopoints stands under the
            // table: the last player is the one above them
            if ($this->request->getGet('rivals')) {
                $index = ($answer['me']['place'] ?? count($table) + 1) - 1;
                $near  = array_values(array_filter([$table[$index - 1] ?? null, $table[$index + 1] ?? null]));

                foreach ($this->game->withUsers($near) as $rival) {
                    $answer['me']['rivals'][$rival['place'] <= $index ? 'above' : 'below'] = $rival;
                }
            }
        }

        return $this->respond($answer);
    }

    /**
     * The rating of a season, overall or of a location: the best players, the visitor's own
     * line, the locations the season is played in (for the scope).
     *
     * GET /game/leaders?season=&type=region&id=12&limit=&offset=
     *   → { items: [{ place, points, places, quests, user }], count, me?, locations }
     *
     * @return ResponseInterface
     */
    public function leaders(): ResponseInterface
    {
        $id = $this->request->getGet('season', FILTER_SANITIZE_SPECIAL_CHARS);

        $season = $id ? $this->game->find($id) : $this->game->current();

        if ($id && !$season) {
            return $this->failNotFound();
        }

        // Between seasons there is nobody to rate
        if (!$season) {
            return $this->respond(['items' => [], 'count' => 0, 'locations' => []]);
        }

        $type = $this->request->getGet('type', FILTER_SANITIZE_SPECIAL_CHARS) ?: null;
        $id   = (int) $this->request->getGet('id', FILTER_SANITIZE_NUMBER_INT);

        if ($type !== null && (!GameLibrary::locationColumn($type) || !$id)) {
            return $this->failValidationErrors(lang('Game.badLocation'));
        }

        $limit  = max(1, min((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?: self::LEADERS_DEFAULT), self::LEADERS_MAX));
        $offset = max(0, (int) $this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT));
        $table  = $this->game->table($season['id'], $type, $type ? $id : null);
        $locale = $this->request->getLocale();

        $answer = [
            'items'     => $this->game->withUsers(array_slice($table, $offset, $limit)),
            'count'     => count($table),
            'locations' => array_merge(
                $this->game->locations($season['id'], 'region', $locale),
                $this->game->locations($season['id'], 'locality', $locale, 6)
            ),
        ];

        if ($this->session->user) {
            $me = $this->standing($table, $this->session->user->id);

            if ($me['place'] !== null) {
                $answer['me'] = $me;
            }
        }

        return $this->respond($answer);
    }

    /**
     * A season with its podium: the page of a past season, frozen once closed.
     *
     * GET /game/seasons/:id → { season, awards, totals, winners, me? }
     *
     * @param string|null $id the season's id, without the slug of its page's address
     *
     * @return ResponseInterface
     */
    public function season($id = null): ResponseInterface
    {
        $season = $id ? $this->game->find((string) $id) : null;

        if (!$season) {
            return $this->failNotFound();
        }

        $locale = $this->request->getLocale();
        $table  = $season['from'] <= GameLibrary::today() ? $this->game->table($season['id']) : [];
        $answer = [
            'season'  => $this->seasonInfo($season, $locale),
            'awards'  => $this->game->seasonAwards($season, $this->session->user?->id, $locale),
            'totals'  => [
                'players' => count($table),
                'places'  => $this->placesCount($season['id']),
            ],
            'winners' => $this->game->withUsers(array_slice($table, 0, 3)),
        ];

        if ($this->session->user) {
            $me = $this->standing($table, $this->session->user->id);

            if ($me['place'] !== null) {
                $answer['me'] = $me;
            }
        }

        return $this->respond($answer);
    }

    /**
     * The seasons for the administrator's page, the latest start first.
     *
     * GET /game/seasons/manage → { items: SeasonAdmin[] }
     *
     * @return ResponseInterface
     */
    public function manage(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $seasons = $this->game->all();
        $counts  = [];

        // The points of all the seasons in one query
        if ($seasons) {
            $rows   = Database::connect()->table('game_points')
                ->select('season, COUNT(*) AS cnt', false)
                ->groupBy('season')
                ->get()->getResultArray();
            $counts = array_column($rows, 'cnt', 'season');
        }

        return $this->respond(['items' => array_map(
            fn (array $season) => $this->adminInfo($season, (int) ($counts[$season['id']] ?? 0)),
            $seasons
        )]);
    }

    /**
     * One season with everything the form edits.
     *
     * GET /game/seasons/manage/:id → SeasonAdmin
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function manageShow($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $season = $id ? $this->game->find((string) $id) : null;

        return $season ? $this->respond($this->adminInfo($season)) : $this->failNotFound();
    }

    /**
     * A new season: the dates, the title and the texts; the pictures come after, one by one.
     *
     * POST /game/seasons { title_ru, title_en?, description_ru?, description_en?, starts_on, ends_on } → 201 SeasonAdmin
     *
     * @return ResponseInterface
     */
    public function create(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $input = $this->adminInput();

        if ($input === null) {
            return $this->failValidationErrors(lang('Game.badBody'));
        }

        [$season, $errors] = $this->game->createSeason($input);

        if ($errors) {
            return $this->failValidationErrors($errors);
        }

        return $this->respondCreated($this->adminInfo($season));
    }

    /**
     * Changes a season; only what is sent. The dates of a closed season stay: its table is frozen.
     *
     * PATCH /game/seasons/:id (the fields of create) → SeasonAdmin
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function update($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $input = $this->adminInput();

        if ($input === null) {
            return $this->failValidationErrors(lang('Game.badBody'));
        }

        [$season, $errors] = $id ? $this->game->updateSeason((string) $id, $input) : [null, []];

        // Errors first: a busy lock answers without a season, and that is not "not found"
        if ($errors) {
            return $this->failValidationErrors($errors);
        }

        if (!$season) {
            return $this->failNotFound();
        }

        return $this->respond($this->adminInfo($season));
    }

    /**
     * Deletes a season nobody has played in: one with points is a part of the history.
     *
     * DELETE /game/seasons/:id → { id }, 400 when it has points
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        [$season, $errors] = $id ? $this->game->deleteSeason((string) $id) : [null, []];

        // Errors first: a busy lock answers without a season, and that is not "not found"
        if ($errors) {
            return $this->failValidationErrors($errors);
        }

        if (!$season) {
            return $this->failNotFound();
        }

        foreach (self::IMAGE_COLUMNS as $column) {
            AdminImageLibrary::remove($season[$column], 'seasons');
        }

        return $this->respondDeleted(['id' => $season['id']]);
    }

    /**
     * A picture of a season, uploaded by an administrator: the medal of every participant
     * (`kind` = `participant`, the default; it is also the season's picture) or its variant for
     * the places 1–3 (`gold`, `silver`, `bronze`). PNG or
     * SVG, up to 1 MB, like an achievement's picture. A new picture replaces the old one.
     *
     * POST /game/seasons/:id/image (multipart, `image`, `kind`) → SeasonAdmin
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function seasonImage($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $season = $id ? $this->game->find((string) $id) : null;

        if (!$season) {
            return $this->failNotFound();
        }

        $kind = (string) ($this->request->getPost('kind') ?: 'participant');

        if (!isset(GameLibrary::IMAGE_KINDS[$kind])) {
            return $this->failValidationErrors(['kind' => lang('Game.seasonBadKind')]);
        }

        $file = $this->request->getFile('image');

        if (!$file || !$file->isValid()) {
            return $this->failValidationErrors(lang('Game.badImage'));
        }

        $type = AdminImageLibrary::kind($file);

        if ($type === null) {
            return $this->failValidationErrors(lang('Game.badImage'));
        }

        $stored = AdminImageLibrary::store($file, $type, 'seasons', $season['id'] . '_' . $kind);

        if ($stored === null) {
            return $this->failServerError(lang('Game.seasonError'));
        }

        $column = GameLibrary::IMAGE_KINDS[$kind];

        Database::connect()->table('game_seasons')->where('id', $season['id'])->update([
            $column      => $stored,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        AdminImageLibrary::remove($season[$column], 'seasons');

        return $this->respond($this->adminInfo($this->game->find($season['id'])));
    }

    /**
     * Takes a picture off a season and deletes its file.
     *
     * DELETE /game/seasons/:id/image?kind=gold → SeasonAdmin
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function seasonImageDelete($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $season = $id ? $this->game->find((string) $id) : null;

        if (!$season) {
            return $this->failNotFound();
        }

        $kind = (string) ($this->request->getGet('kind') ?: 'participant');

        if (!isset(GameLibrary::IMAGE_KINDS[$kind])) {
            return $this->failValidationErrors(['kind' => lang('Game.seasonBadKind')]);
        }

        $column = GameLibrary::IMAGE_KINDS[$kind];

        Database::connect()->table('game_seasons')->where('id', $season['id'])->update([
            $column      => null,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        AdminImageLibrary::remove($season[$column], 'seasons');

        return $this->respond($this->adminInfo($this->game->find($season['id'])));
    }

    /**
     * The valuable places: what the visitor has not confirmed in the season yet, the most
     * points first. With `lat` / `lon` — of the places nearest to that point, with the distance;
     * with a `radius` (km) too — of the places within it, and when none is there, the nearest ones.
     *
     * GET /game/places?lat=&lon=&radius=&limit= → { items: [PlaceListItem + { game: { points, position } }], count }
     *
     * @return ResponseInterface
     */
    public function places(): ResponseInterface
    {
        $season = $this->game->current();

        // No season, no points to get
        if (!$season) {
            return $this->respond(['items' => [], 'count' => 0]);
        }

        $limit  = max(1, min((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?: self::PLACES_DEFAULT), self::PLACES_MAX));
        $lat    = $this->request->getGet('lat');
        $lon    = $this->request->getGet('lon');
        $userId = $this->session->user?->id;

        $model    = new PlacesModel();
        $distance = is_numeric($lat) && is_numeric($lon) ? $model->makeDistanceSQL((float) $lat, (float) $lon) : '';

        $model->select('places.id, places.category, places.rating, places.views' . $distance)
            ->where('places.deleted_at', null);

        if ($userId) {
            // Counted already this season: nothing more to get there
            $model->where(
                'NOT EXISTS (SELECT 1 FROM game_points gp WHERE gp.place_id = places.id AND gp.kind = \'place\' AND gp.season = '
                . $model->db->escape($season['id']) . ' AND gp.user_id = ' . $model->db->escape($userId) . ')',
                null,
                false
            );
        }

        // Never the whole table: the nearest ones, or the best known ones
        if ($distance) {
            $model->orderBy('distance', 'ASC')->limit(self::NEARBY_POOL);
        } else {
            $model->orderBy('places.views', 'DESC')->limit(self::EVERYWHERE_POOL);
        }

        $rows   = $model->get()->getResult();
        $radius  = $distance ? min((float) $this->request->getGet('radius'), self::RADIUS_MAX) : 0;
        $nearest = false;

        // Within the radius only: where it is worth going is somewhere one can get to. Nothing
        // there — the nearest places, as they come, the rows being ordered by distance already
        if ($radius > 0) {
            $within  = array_values(array_filter($rows, static fn ($row) => (float) $row->distance <= $radius));
            $nearest = !$within;
            $rows    = $within ?: $rows;
        }

        $values = $this->game->values($rows, $season, $userId);

        // The most points first; then the nearest, or the most viewed
        if (!$nearest) {
            usort($rows, static function ($a, $b) use ($values, $distance) {
                return $values[$b->id]['points'] <=> $values[$a->id]['points']
                    ?: ($distance ? (float) $a->distance <=> (float) $b->distance : (int) $b->views <=> (int) $a->views);
            });
        }

        $rows      = array_slice($rows, 0, $limit);
        $formatter = new PlaceFormatterLibrary();
        $places    = $formatter->listItems(array_column($rows, 'id'), $this->request->getLocale());
        $items     = [];

        foreach ($rows as $row) {
            if (!isset($places[$row->id])) {
                continue;
            }

            $place       = $places[$row->id];
            $place->game = [
                'points'   => $values[$row->id]['points'],
                'position' => $values[$row->id]['position'],
            ];

            if ($distance) {
                $place->distance = $formatter->formatDistance($row->distance);
            }

            $items[] = $place;
        }

        $formatter->markVisitorState($items, $userId);

        return $this->respond(['items' => $items, 'count' => count($items)]);
    }

    /**
     * "My season": the visitor's own chronicle of the current season — every place counted for
     * them, the latest first, with what it brought and how it was confirmed.
     *
     * GET /game/mine?limit=&offset= → { items: [{ id, points, way, created, place }], count, points }
     *
     * @return ResponseInterface
     */
    public function mine(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        $season = $this->game->current();

        if (!$season) {
            return $this->respond(['items' => [], 'count' => 0, 'points' => 0]);
        }

        $limit  = max(1, min((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?: self::MINE_DEFAULT), self::MINE_MAX));
        $offset = max(0, (int) $this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT));

        $db    = Database::connect();
        $where = ['gp.season' => $season['id'], 'gp.user_id' => $this->session->user->id, 'gp.kind' => 'place'];
        $mine  = static fn () => $db->table('game_points gp')
            ->join('places', 'places.id = gp.place_id AND places.deleted_at IS NULL')
            ->where($where);

        $totals = $mine()->select('COUNT(*) AS cnt, COALESCE(SUM(gp.points), 0) AS points', false)->get()->getRow();
        $page   = $mine()
            ->select('gp.id, gp.points, gp.way, gp.place_id, gp.created_at')
            ->orderBy('gp.created_at', 'DESC')
            ->orderBy('gp.id', 'DESC')
            ->limit($limit, $offset)
            ->get()->getResultArray();

        $places = (new PlaceFormatterLibrary())->listItems(array_values(array_unique(array_column($page, 'place_id'))), $this->request->getLocale());
        $items  = [];

        foreach ($page as $row) {
            if (!isset($places[$row['place_id']])) {
                continue;
            }

            $items[] = [
                'id'      => $row['id'],
                'points'  => (int) $row['points'],
                'way'     => $row['way'],
                'created' => new \DateTime((string) $row['created_at']),
                'place'   => $places[$row['place_id']],
            ];
        }

        return $this->respond(['items' => $items, 'count' => (int) $totals->cnt, 'points' => (int) $totals->points]);
    }

    /**
     * What is going on in the game: the latest confirmed places and walked quests of the
     * current season, with who did it. The visits of a riddle quest not walked to the end are
     * left out (they are its answers).
     *
     * GET /game/recent?limit= → { items: [{ id, kind, points, way, created, user, place? | quest? }] }
     *
     * @return ResponseInterface
     */
    public function recent(): ResponseInterface
    {
        $season = $this->game->current();

        if (!$season) {
            return $this->respond(['items' => []]);
        }

        $limit  = max(1, min((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?: 6), 20));
        $locale = $this->request->getLocale();

        $rows = Database::connect()->table('game_points gp')
            ->select('gp.id, gp.kind, gp.points, gp.way, gp.place_id, gp.quest_id, gp.user_id, gp.created_at, quests.title_ru, quests.title_en')
            ->join('users_visited_places v', 'v.id = gp.visit_id', 'left')
            ->join('quests', 'quests.id = gp.quest_id AND quests.deleted_at IS NULL', 'left')
            ->where('gp.season', $season['id'])
            // A riddle's answer is not told; a place a photo counted is
            ->groupStart()->where('v.hidden !=', VisitsModel::HIDDEN_RIDDLE)->orWhere('v.id', null)->groupEnd()
            ->orderBy('gp.created_at', 'DESC')
            ->limit($limit)
            ->get()->getResultArray();

        $places = (new PlaceFormatterLibrary())->listItems(array_values(array_unique(array_filter(array_column($rows, 'place_id')))), $locale);
        $users  = array_column($this->game->withUsers(array_map(
            static fn (string $id) => ['user_id' => $id, 'place' => 0, 'points' => 0, 'places' => 0, 'quests' => 0],
            array_values(array_unique(array_column($rows, 'user_id')))
        )), 'user');
        $users  = array_column($users, null, 'id');
        $items  = [];

        foreach ($rows as $row) {
            if (!isset($users[$row['user_id']])) {
                continue;
            }

            $item = [
                'id'      => $row['id'],
                'kind'    => $row['kind'],
                'points'  => (int) $row['points'],
                'way'     => $row['way'],
                'created' => new \DateTime((string) $row['created_at']),
                'user'    => $users[$row['user_id']],
            ];

            if ($row['kind'] === 'quest') {
                if (!$row['quest_id'] || $row['title_ru'] === null) {
                    continue;
                }

                $item['quest'] = [
                    'id'    => $row['quest_id'],
                    'slug'  => QuestsLibrary::slugOf($row),
                    'title' => $locale === 'ru' ? ($row['title_ru'] ?: $row['title_en']) : ($row['title_en'] ?: $row['title_ru']),
                ];
            } elseif (isset($places[$row['place_id']])) {
                $item['place'] = $places[$row['place_id']];
            } else {
                continue;
            }

            $items[] = $item;
        }

        return $this->respond(['items' => $items]);
    }

    /**
     * "I am here": the visitor's position, asked by their tap on the spot, is compared with the
     * place and dropped — only the fact is kept. Near the place it checks them in (the visit of
     * the week, or a new one), confirms the visit and counts the place in the season.
     *
     * POST /game/confirm { place, lat, lon, accuracy?, visitedAt? }
     *   → { confirmed: true, isNew, points, total, visit, season } or 400 with how far the place is
     *
     * @return ResponseInterface
     */
    public function confirm(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        $input = $this->request->getJSON(true) ?: [];

        if (empty($input['place']) || !is_string($input['place'])) {
            return $this->failValidationErrors(lang('Visits.missingPlaceId'));
        }

        $position = self::position($input);

        if (!$position) {
            return $this->failValidationErrors(lang('Game.badPosition'));
        }

        if (!self::confirmAllowed($this->session->user->id)) {
            $this->response->setHeader('Retry-After', (string) max(1, Services::throttler()->getTokenTime()));

            return $this->failTooManyRequests(lang('Game.questTooManyConfirms'));
        }

        $day = VisitsLibrary::day($input['visitedAt'] ?? null);

        if ($day === false) {
            return $this->failValidationErrors(lang('Visits.badDate'));
        }

        $place = (new PlacesModel())->select('id, user_id, category, lat, lon, created_at')->find($input['place']);

        if (!$place) {
            return $this->failNotFound(lang('Visits.placeNotFound'));
        }

        [$near, $distance] = $this->game->isNear($place, $position['lat'], $position['lon'], $position['accuracy']);

        if (!$near) {
            return $this->failValidationErrors(lang('Game.far', [self::distanceText($distance, $this->request->getLocale())]));
        }

        try {
            $result = $this->game->confirm($this->session->user->id, $place, GameLibrary::WAY_GEO, $day);

            (new QuestsLibrary())->placeConfirmed($this->session->user->id, $place->id, $result['visit']->id);

            return $this->respond([
                'confirmed' => true,
                'isNew'     => $result['isNew'],
                'points'    => $result['points'],
                'total'     => $result['total'],
                'season'    => $result['season']['id'] ?? null,
                'visit'     => [
                    'id'        => $result['visit']->id,
                    'visitedAt' => substr((string) $result['visit']->visited_at, 0, 10),
                ],
            ]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Visits.error'));
        }
    }

    /**
     * How much of their locations a person has explored: the places they visited or added, of
     * all the places there — regions, and the towns within them.
     *
     * GET /game/exploration?user=:id → { world: { explored, total }, regions: [{ type, id, title, slug, explored, total }], localities: […] }
     *
     * @return ResponseInterface
     */
    public function exploration(): ResponseInterface
    {
        $userId = $this->request->getGet('user', FILTER_SANITIZE_SPECIAL_CHARS) ?: $this->session->user?->id;

        if (!$userId) {
            return $this->respond(['world' => ['explored' => 0, 'total' => 0], 'regions' => [], 'localities' => []]);
        }

        $locale = $this->request->getLocale();
        // The hidden visits of a riddle quest would name the town of its answer to anyone else
        $own    = $userId === $this->session->user?->id;

        return $this->respond([
            // Of all the places of the site: the person's share of the world
            'world'      => $this->game->exploredWorld($userId, $own),
            'regions'    => $this->game->explored($userId, 'region', $locale, 6, $own),
            'localities' => $this->game->explored($userId, 'locality', $locale, 6, $own),
        ]);
    }

    /**
     * A person in the game, for their profile: the current season's score and place, the
     * confirmed places of all time, the quests walked, the seasons they took part in.
     *
     * GET /game/users/:id → { season (null between seasons), points, places, place, players, confirmed, walked, seasons }
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function user($id = null): ResponseInterface
    {
        if (!$id) {
            return $this->failNotFound();
        }

        $db     = Database::connect();
        $season = $this->game->current();
        $locale = $this->request->getLocale();
        $me     = $this->standing($season ? $this->game->table($season['id']) : [], (string) $id);

        return $this->respond($me + [
            'season'    => $season ? $this->seasonInfo($season, $locale) : null,
            'confirmed' => (int) ($db->table('users_visited_places')
                ->select('COUNT(DISTINCT place_id) AS cnt', false)
                ->where('user_id', $id)
                ->where('hidden !=', VisitsModel::HIDDEN_RIDDLE)
                ->where('confirmed IS NOT NULL', null, false)
                ->get()->getRow()->cnt ?? 0),
            'walked'    => $db->table('quests_walks')->where('user_id', $id)->where('finished_at IS NOT NULL', null, false)->countAllResults(),
            // The seasons they took part in: the season badges of the profile
            'seasons'   => $this->game->participations((string) $id, $locale),
        ]);
    }

    /**
     * A person's tasks: the limited awards running now (begun, not over), whatever season is on,
     * each with their `earned` and `progress` — "Задания" of the profile's side column.
     *
     * GET /game/users/:id/tasks → { data: LimitedAward[] }
     */
    public function tasks($id = null): ResponseInterface
    {
        if (!$id) {
            return $this->failNotFound();
        }

        return $this->respond(['data' => $this->game->runningAwards((string) $id, $this->request->getLocale())]);
    }

    /** The pictures of a season, by column */
    private const IMAGE_COLUMNS = ['medal_participant', 'medal_gold', 'medal_silver', 'medal_bronze'];

    /** How many places have a point in a season */
    private function placesCount(string $seasonId): int
    {
        return (int) (Database::connect()->table('game_points')
            ->select('COUNT(DISTINCT place_id) AS cnt', false)
            ->where(['season' => $seasonId, 'kind' => 'place'])
            ->get()->getRow()->cnt ?? 0);
    }

    /**
     * A season as the API sends it: the texts in the visitor's language (English falls back to
     * the Russian), the medal pictures, and where the season stands against today.
     *
     * @param array<string, mixed> $season GameLibrary::find()
     * @return array<string, mixed>
     */
    private function seasonInfo(array $season, string $locale): array
    {
        $today = GameLibrary::today();

        return [
            'id'          => $season['id'],
            'slug'        => $season['slug'],
            'title'       => GameLibrary::localized($season, 'title', $locale) ?? $season['id'],
            'description' => GameLibrary::localized($season, 'description', $locale),
            'from'        => $season['from'],
            'to'          => $season['to'],
            'daysLeft'    => $today <= $season['to'] ? (int) ((strtotime($season['to']) - strtotime($today)) / DAY) + 1 : 0,
            'lastDay'     => $this->game->lastDay($season),
            // The season's picture: the medal of every participant; a badge is drawn in its place without one
            'image'       => $season['image'],
            'closed'      => $season['closed_at'] !== null,
            'current'     => $today >= $season['from'] && $today <= $season['to'],
            'upcoming'    => $today < $season['from'],
            'medals'      => [
                'gold'        => $season['medal_gold'],
                'silver'      => $season['medal_silver'],
                'bronze'      => $season['medal_bronze'],
                'participant' => $season['medal_participant'],
            ],
        ];
    }

    /**
     * A season as the administrator's page edits it: both languages, the stored dates, and how
     * much is played in it (`points` above zero keeps it from being deleted).
     *
     * @param array<string, mixed> $season GameLibrary::find()
     * @param int|null             $points the points of the season when the caller counted them already
     * @return array<string, mixed>
     */
    private function adminInfo(array $season, ?int $points = null): array
    {
        $today       = GameLibrary::today();
        $points    ??= Database::connect()->table('game_points')->where('season', $season['id'])->countAllResults();
        $datesLocked = $season['closed_at'] !== null || $today > $this->game->lastDay($season);

        return [
            'id'             => $season['id'],
            'slug'           => $season['slug'],
            'title_ru'       => $season['title_ru'],
            'title_en'       => $season['title_en'],
            'description_ru' => $season['description_ru'],
            'description_en' => $season['description_en'],
            'starts_on'      => $season['from'],
            'ends_on'        => $season['to'],
            'image'          => $season['image'],
            'medals'         => [
                'gold'        => $season['medal_gold'],
                'silver'      => $season['medal_silver'],
                'bronze'      => $season['medal_bronze'],
                'participant' => $season['medal_participant'],
            ],
            'closed'         => $season['closed_at'] !== null,
            'closed_at'      => $season['closed_at'],
            'players'        => $season['players'],
            'places'         => $season['places'],
            'points'         => $points,
            'current'        => $today >= $season['from'] && $today <= $season['to'],
            'upcoming'       => $today < $season['from'],
            // The dates are frozen once the season is closed or its grace days are over (the
            // tick may not have run yet); the start once anything is counted in it
            'datesLocked'    => $datesLocked,
            'startLocked'    => $datesLocked || $points > 0,
        ];
    }

    /**
     * A person's line of a table: null place when they have no points there.
     *
     * @param array<int, array<string, mixed>> $table
     * @return array{place: ?int, points: int, places: int, quests: int, players: int, ahead: ?int, behind: ?int}
     */
    private function standing(array $table, string $userId): array
    {
        foreach ($table as $index => $row) {
            if ($row['user_id'] === $userId) {
                return [
                    'place'   => $row['place'],
                    'points'  => $row['points'],
                    'places'  => $row['places'],
                    'quests'  => $row['quests'],
                    'players' => count($table),
                    // The points to the player above: something to reach
                    'ahead'   => $index > 0 ? $table[$index - 1]['points'] - $row['points'] : null,
                    // The points over the player below: null for the last one
                    'behind'  => isset($table[$index + 1]) ? $row['points'] - $table[$index + 1]['points'] : null,
                ];
            }
        }

        return ['place' => null, 'points' => 0, 'places' => 0, 'quests' => 0, 'players' => count($table), 'ahead' => null, 'behind' => null];
    }

    /**
     * The last closed season with its podium (a list of one: the game page shows only it;
     * the older ones are reached from the profiles' season badges).
     *
     * @return array<int, array<string, mixed>>
     */
    private function pastSeasons(string $locale): array
    {
        $rows = Database::connect()->table('game_seasons')
            ->where('closed_at IS NOT NULL', null, false)
            ->orderBy('starts_on', 'DESC')
            ->limit(1)
            ->get()->getResult();

        $items = [];

        foreach ($rows as $row) {
            $season = GameLibrary::fromRow($row);

            $items[] = $this->seasonInfo($season, $locale) + [
                'players' => $season['players'],
                'places'  => $season['places'],
                'winners' => $this->game->withUsers(array_slice($this->game->table($season['id']), 0, 3)),
            ];
        }

        return $items;
    }

    /** Whether one more confirmation by a position is taken from this person now (CONFIRMS_PER_*) */
    public static function confirmAllowed(string $userId): bool
    {
        $throttler = Services::throttler();

        return $throttler->check('game_confirm_m_' . $userId, self::CONFIRMS_PER_MINUTE, MINUTE)
            && $throttler->check('game_confirm_h_' . $userId, self::CONFIRMS_PER_HOUR, HOUR)
            && $throttler->check('game_confirm_d_' . $userId, self::CONFIRMS_PER_DAY, DAY);
    }

    /**
     * The position of an "I am here" request: real coordinates, the accuracy when sent.
     *
     * @param array<string, mixed> $input
     * @return array{lat: float, lon: float, accuracy: ?float}|null
     */
    public static function position(array $input): ?array
    {
        $lat = $input['lat'] ?? null;
        $lon = $input['lon'] ?? null;

        if (!is_numeric($lat) || !is_numeric($lon) || abs((float) $lat) > 90 || abs((float) $lon) > 180 || ((float) $lat === 0.0 && (float) $lon === 0.0)) {
            return null;
        }

        return [
            'lat'      => (float) $lat,
            'lon'      => (float) $lon,
            'accuracy' => is_numeric($input['accuracy'] ?? null) ? (float) $input['accuracy'] : null,
        ];
    }

    /** "850 м", "2,4 км": how far the place is, for the refusal */
    public static function distanceText(int $metres, string $locale): string
    {
        if ($metres < 1000) {
            return (int) (round($metres / 10) * 10) . ($locale === 'ru' ? ' м' : ' m');
        }

        $km = number_format($metres / 1000, $metres < 10000 ? 1 : 0, $locale === 'ru' ? ',' : '.', ' ');

        return $km . ($locale === 'ru' ? ' км' : ' km');
    }
}
