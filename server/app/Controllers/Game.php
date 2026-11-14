<?php

namespace App\Controllers;

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
        $season = GameLibrary::seasonOf(date('Y-m-d'));
        $this->game->ensureSeason($season);

        $db    = Database::connect();
        $table = $this->game->table($season['id']);

        $answer = [
            'season' => $this->seasonInfo($season),
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
            'awards' => $this->game->seasonAwards($season, $this->session->user?->id, $this->request->getLocale()),
            'totals' => [
                'players' => count($table),
                'places'  => (int) ($db->table('game_points')
                    ->select('COUNT(DISTINCT place_id) AS cnt', false)
                    ->where(['season' => $season['id'], 'kind' => 'place'])
                    ->get()->getRow()->cnt ?? 0),
                'quests'  => $db->table('quests')->where(['status' => 'published', 'deleted_at' => null])->countAllResults(),
            ],
            'seasons' => $this->pastSeasons(),
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
        $season = $this->requestedSeason();

        if (!$season) {
            return $this->failNotFound();
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
     * @param string|null $id e.g. `2026-cold`
     *
     * @return ResponseInterface
     */
    public function season($id = null): ResponseInterface
    {
        $season = $id ? GameLibrary::seasonById((string) $id) : null;

        if (!$season) {
            return $this->failNotFound();
        }

        $db  = Database::connect();
        $row = $db->table('game_seasons')->where('id', $season['id'])->get()->getRow();

        // A season nobody has met yet (the future, the years before the game)
        if (!$row) {
            return $this->failNotFound();
        }

        $table  = $this->game->table($season['id']);
        $answer = [
            'season'  => $this->seasonInfo($season, $row),
            'awards'  => $this->game->seasonAwards($season, $this->session->user?->id, $this->request->getLocale()),
            'totals'  => [
                'players' => count($table),
                'places'  => (int) ($db->table('game_points')
                    ->select('COUNT(DISTINCT place_id) AS cnt', false)
                    ->where(['season' => $season['id'], 'kind' => 'place'])
                    ->get()->getRow()->cnt ?? 0),
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
     * The picture of a season, uploaded by an administrator: the one thing of a season made by
     * hand. PNG or SVG, up to 1 MB, like an achievement's picture.
     *
     * POST /game/seasons/:id/image (multipart, `image`) → { id, image }
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function seasonImage($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->session->isAuth ? $this->failForbidden() : $this->failUnauthorized();
        }

        $season = $id ? GameLibrary::seasonById((string) $id) : null;

        if (!$season || !$this->game->ensureSeason($season)) {
            return $this->failNotFound();
        }

        $file = $this->request->getFile('image');

        if (!$file || !$file->isValid()) {
            return $this->failValidationErrors(lang('Game.badImage'));
        }

        if (!in_array($file->getMimeType(), ['image/png', 'image/svg+xml'], true) || $file->getSize() > 1024 * 1024) {
            return $this->failValidationErrors(lang('Game.badImage'));
        }

        $path = FCPATH . 'uploads/seasons/';

        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }

        $name = $season['id'] . '_' . time() . '.' . $file->getExtension();

        if (!$file->move($path, $name)) {
            return $this->failServerError(lang('Game.questError'));
        }

        Database::connect()->table('game_seasons')->where('id', $season['id'])->update(['image' => 'uploads/seasons/' . $name]);

        return $this->respond(['id' => $season['id'], 'image' => 'uploads/seasons/' . $name]);
    }

    /**
     * The valuable places: what the visitor has not confirmed in the season yet, the most
     * points first. With `lat` / `lon` — of the places nearest to that point, with the distance.
     *
     * GET /game/places?lat=&lon=&limit= → { items: [PlaceListItem + { game: { points, position } }], count }
     *
     * @return ResponseInterface
     */
    public function places(): ResponseInterface
    {
        $season = GameLibrary::seasonOf(date('Y-m-d'));
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
        $values = $this->game->values($rows, $season, $userId);

        // The most points first; then the nearest, or the most viewed
        usort($rows, static function ($a, $b) use ($values, $distance) {
            return $values[$b->id]['points'] <=> $values[$a->id]['points']
                ?: ($distance ? (float) $a->distance <=> (float) $b->distance : (int) $b->views <=> (int) $a->views);
        });

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

        $season = GameLibrary::seasonOf(date('Y-m-d'));
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
        $season = GameLibrary::seasonOf(date('Y-m-d'));
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
     * GET /game/users/:id → { season, points, places, place, players, confirmed, walked, seasons }
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
        $season = GameLibrary::seasonOf(date('Y-m-d'));
        $me     = $this->standing($this->game->table($season['id']), (string) $id);

        return $this->respond($me + [
            'season'    => $this->seasonInfo($season),
            'confirmed' => (int) ($db->table('users_visited_places')
                ->select('COUNT(DISTINCT place_id) AS cnt', false)
                ->where('user_id', $id)
                ->where('hidden !=', VisitsModel::HIDDEN_RIDDLE)
                ->where('confirmed IS NOT NULL', null, false)
                ->get()->getRow()->cnt ?? 0),
            'walked'    => $db->table('quests_walks')->where('user_id', $id)->where('finished_at IS NOT NULL', null, false)->countAllResults(),
            // The seasons they took part in: the season badges of the profile
            'seasons'   => $this->game->participations((string) $id),
        ]);
    }

    /**
     * The season of `?season=`, the current one without it.
     *
     * @return array{id: string, key: string, year: int, from: string, to: string}|null
     */
    private function requestedSeason(): ?array
    {
        $id = $this->request->getGet('season', FILTER_SANITIZE_SPECIAL_CHARS);

        return $id ? GameLibrary::seasonById($id) : GameLibrary::seasonOf(date('Y-m-d'));
    }

    /**
     * A season as the API sends it.
     *
     * @return array<string, mixed>
     */
    private function seasonInfo(array $season, ?object $row = null): array
    {
        $today = date('Y-m-d');
        $row ??= Database::connect()->table('game_seasons')->where('id', $season['id'])->get()->getRow();

        return $season + [
            // The season's picture, drawn by the owner; a badge is drawn in its place without one
            'image'    => $row->image ?? null,
            'daysLeft' => $today <= $season['to'] ? (int) ((strtotime($season['to']) - strtotime($today)) / DAY) + 1 : 0,
            'lastDay'  => $this->game->lastDay($season),
            'closed'   => $row && $row->closed_at !== null,
            'current'  => $today >= $season['from'] && $today <= $season['to'],
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
    private function pastSeasons(): array
    {
        $rows = Database::connect()->table('game_seasons')
            ->where('closed_at IS NOT NULL', null, false)
            ->orderBy('starts_on', 'DESC')
            ->limit(1)
            ->get()->getResult();

        $items = [];

        foreach ($rows as $row) {
            $season = GameLibrary::seasonById($row->id);

            if (!$season) {
                continue;
            }

            $items[] = $this->seasonInfo($season, $row) + [
                'players' => (int) $row->players,
                'places'  => (int) $row->places,
                'winners' => $this->game->withUsers(array_slice($this->game->table($row->id), 0, 3)),
            ];
        }

        return $items;
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
