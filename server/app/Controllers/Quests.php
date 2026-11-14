<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\QuestsLibrary;
use App\Libraries\SessionLibrary;
use App\Libraries\VisitsLibrary;
use App\Models\QuestsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;
use Throwable;

/**
 * Quests of the game (features/26-game-seasons-and-quests.md): the list, a quest as its
 * walker sees it, "I am here" at a point, and the editor of the administrators (quests are
 * made by hand). The rules are in QuestsLibrary.
 *
 * Not a kind of collection and not cached: what a person has not opened yet (the next step,
 * the answer of a riddle) never leaves the server.
 *
 * @package App\Controllers
 */
class Quests extends ResourceController
{
    private const TITLE_MAX       = 150;
    private const DESCRIPTION_MAX = 5000;

    private const LIMIT_DEFAULT = 12;
    private const LIMIT_MAX     = 48;

    protected SessionLibrary $session;

    protected QuestsLibrary $quests;

    public function __construct()
    {
        $this->session = new SessionLibrary();
        $this->quests  = new QuestsLibrary();
    }

    /**
     * The quests, a page of them: the published ones (an administrator sees the drafts too).
     * The visitor's own come first — the ones they are walking, then the ones they have not
     * begun, the walked ones last; within that the nearest to `lat` / `lon` (by the first
     * point), or the newest. `walk` narrows it: `todo` (not walked to the end), `active`,
     * `idle` (not being walked: never begun or walked to the end — the list under the shelf of
     * the begun ones), `done`; `mode` — one mode; `user` — whose walks are meant (the
     * visitor's by default): a profile's walked quests. With `lat` / `lon` every quest whose
     * start is seen (not a riddle one) has its `distance` in metres.
     *
     * GET /game/quests?limit=&offset=&lat=&lon=&walk=&mode=&user= → { items, count }
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $limit  = max(1, min((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?: self::LIMIT_DEFAULT), self::LIMIT_MAX));
        $offset = max(0, (int) $this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT));
        $lat    = $this->request->getGet('lat');
        $lon    = $this->request->getGet('lon');
        $userId = $this->session->user?->id;
        $db     = Database::connect();

        $builder = $db->table('quests r')->where('r.deleted_at', null);

        if (!$this->isAdmin()) {
            $builder->where('r.status', QuestsModel::STATUS_PUBLISHED);
        }

        // The walks the list is about: the visitor's own, or `user`'s (their profile)
        $walker = $this->request->getGet('user', FILTER_SANITIZE_SPECIAL_CHARS) ?: $userId;

        $builder->join('quests_walks w', 'w.quest_id = r.id AND w.user_id = ' . $db->escape((string) $walker), 'left');

        // `todo` — not walked to the end yet (the game's lists: a walked quest moves to the
        // profile), `active` — being walked, `done` — walked
        switch ($this->request->getGet('walk')) {
            case 'todo':
                $builder->where('w.finished_at', null);
                break;

            case 'active':
                $builder->where('w.id IS NOT NULL', null, false)->where('w.finished_at', null);
                break;

            case 'idle':
                $builder->groupStart()->where('w.id', null)->orWhere('w.finished_at IS NOT NULL', null, false)->groupEnd();
                break;

            case 'done':
                $builder->where('w.finished_at IS NOT NULL', null, false);
                break;
        }

        $mode = $this->request->getGet('mode');

        if (in_array($mode, QuestsModel::MODES, true)) {
            $builder->where('r.mode', $mode);
        }

        $count = (clone $builder)->countAllResults();

        $builder
            ->select('r.*')
            ->orderBy('(w.id IS NOT NULL AND w.finished_at IS NULL)', 'DESC', false)
            ->orderBy('(w.finished_at IS NOT NULL)', 'ASC', false);

        $from = is_numeric($lat) && is_numeric($lon) && abs((float) $lat) <= 90 && abs((float) $lon) <= 180
            ? [(float) $lat, (float) $lon]
            : null;

        if ($from) {
            // The straight line to the first point: enough to put the quests of the visitor's town first
            $builder
                ->join('quests_points rp0', 'rp0.quest_id = r.id AND rp0.position = 0', 'left')
                ->join('places p0', 'p0.id = rp0.place_id', 'left')
                ->orderBy('(POW(p0.lat - ' . (float) $lat . ', 2) + POW((p0.lon - ' . (float) $lon . ') * COS(RADIANS(' . (float) $lat . ')), 2))', 'ASC', false);
        }

        $rows = $builder->orderBy('r.created_at', 'DESC')->limit($limit, $offset)->get()->getResult();

        return $this->respond([
            'items' => $this->quests->listItems($rows, $this->request->getLocale(), $walker, $from),
            'count' => $count,
        ]);
    }

    /**
     * Every quest as a mark on a map — the quests' layer of the maps: where it begins, its first
     * point. A riddle quest is not on the maps: its places are the answers, its search zone is
     * drawn on its own page only. The published ones (an administrator sees the drafts too), no
     * walks: the popup of a mark loads the quest itself.
     *
     * GET /game/quests/marks → { items: [{ id, title, mode, lat, lon }] }
     *
     * @return ResponseInterface
     */
    public function marks(): ResponseInterface
    {
        $locale  = $this->request->getLocale();
        $builder = Database::connect()->table('quests r')
            ->select('r.id, r.mode, r.title_ru, r.title_en, p0.lat, p0.lon')
            ->join('quests_points rp0', 'rp0.quest_id = r.id AND rp0.position = 0', 'left')
            ->join('places p0', 'p0.id = rp0.place_id', 'left')
            ->where('r.deleted_at', null)
            ->whereNotIn('r.mode', QuestsModel::SECRET_MODES);

        if (!$this->isAdmin()) {
            $builder->where('r.status', QuestsModel::STATUS_PUBLISHED);
        }

        $items = [];

        foreach ($builder->orderBy('r.created_at', 'DESC')->get()->getResult() as $row) {
            if ($row->lat === null || $row->lon === null) {
                continue;
            }

            $items[] = [
                'id'    => $row->id,
                'title' => $locale === 'ru' ? ($row->title_ru ?: $row->title_en) : ($row->title_en ?: $row->title_ru),
                'mode'  => $row->mode,
                'lat'   => (float) $row->lat,
                'lon'   => (float) $row->lon,
            ];
        }

        return $this->respond(['items' => $items]);
    }

    /**
     * A quest with its points as the visitor sees them (QuestsLibrary::points()) and their walk.
     * `?edit=1` (administrators): every point, both locales of the texts — the editor's data.
     *
     * GET /game/quests/:id
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        $quest = $this->find($id);

        if (!$quest) {
            return $this->failNotFound(lang('Game.questNotFound'));
        }

        $locale = $this->request->getLocale();
        $userId = $this->session->user?->id;
        $edit   = $this->isAdmin() && $this->request->getGet('edit');
        $item   = $this->quests->listItems([$quest], $locale, $userId, null, true)[0];

        $item['items'] = $this->quests->points($quest, $locale, $userId, (bool) $edit);

        // A signed-in visitor's begun quests against the limit: "Начать квест" is off at the limit
        if ($userId) {
            $item['activeWalks'] = ['count' => $this->quests->activeCount($userId), 'max' => QuestsLibrary::ACTIVE_MAX];
        }

        if ($edit) {
            $item['titleRu']       = $quest->title_ru;
            $item['titleEn']       = $quest->title_en;
            $item['descriptionRu'] = $quest->description_ru;
            $item['descriptionEn'] = $quest->description_en;
        }

        if ($quest->user_id) {
            $author = Database::connect()->table('users')->select('id, name, avatar')->where('id', $quest->user_id)->get()->getRow();

            if ($author) {
                $item['author'] = [
                    'id'     => $author->id,
                    'name'   => $author->name,
                    'avatar' => (new AvatarLibrary())->buildPath($author->id, $author->avatar, 'small'),
                ];
            }
        }

        // Who walked it to the end, the latest first: a quest is a thing people do together
        $item['walkers'] = $this->walkers($quest->id);

        return $this->respond($item);
    }

    /**
     * Create a quest: administrators only.
     *
     * POST /game/quests { titleRu, titleEn?, descriptionRu?, descriptionEn?, mode, status, points: [{ place, hintRu?, hintEn? }] }
     *
     * @return ResponseInterface
     */
    public function create(): ResponseInterface
    {
        if (!$this->isAdmin()) {
            return $this->session->isAuth ? $this->failForbidden() : $this->failUnauthorized();
        }

        $input = $this->request->getJSON(true) ?: [];
        $data  = $this->fields($input, true);

        if (isset($data['errors'])) {
            return $this->failValidationErrors($data['errors']);
        }

        if (!is_array($input['points'] ?? null)) {
            return $this->failValidationErrors(['points' => lang('Game.badPoints', [QuestsLibrary::POINTS_MIN, QuestsLibrary::POINTS_MAX])]);
        }

        $model = new QuestsModel();

        try {
            $model->insert($data + ['user_id' => $this->session->user->id]);
            $id = $model->getLastGeneratedId();

            try {
                $this->quests->savePoints($id, $input['points'], $data['mode']);
            } catch (\InvalidArgumentException $e) {
                $model->delete($id, true);

                return $this->failValidationErrors(['points' => $this->pointsError($e)]);
            }

            return $this->respondCreated(['id' => $id]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Game.questError'));
        }
    }

    /**
     * Update a quest: administrators only. The fields sent are changed; `points` replaces the
     * list (a place that stays keeps the walkers' confirmations).
     *
     * PATCH /game/quests/:id
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function update($id = null): ResponseInterface
    {
        if (!$this->isAdmin()) {
            return $this->session->isAuth ? $this->failForbidden() : $this->failUnauthorized();
        }

        $quest = $this->find($id);

        if (!$quest) {
            return $this->failNotFound(lang('Game.questNotFound'));
        }

        $input = $this->request->getJSON(true) ?: [];
        $data  = $this->fields($input, false, $quest);

        if (isset($data['errors'])) {
            return $this->failValidationErrors($data['errors']);
        }

        try {
            $mode = $data['mode'] ?? $quest->mode;

            if (array_key_exists('points', $input)) {
                if (!is_array($input['points'])) {
                    throw new \InvalidArgumentException('points');
                }

                $this->quests->savePoints($quest->id, $input['points'], $mode);
            } elseif ($mode === QuestsModel::MODE_PHOTOS && $mode !== $quest->mode) {
                // Turned into a photo quest with the points it has: each must have a photo
                $placeIds = array_column(
                    \Config\Database::connect()->table('quests_points')->select('place_id')->where('quest_id', $quest->id)->get()->getResultArray(),
                    'place_id'
                );

                if ($this->quests->withoutPhoto($placeIds)) {
                    throw new \InvalidArgumentException('photos');
                }
            }

            if ($data) {
                (new QuestsModel())->update($quest->id, $data);
            }

            return $this->respond(['id' => $quest->id]);
        } catch (\InvalidArgumentException $e) {
            return $this->failValidationErrors(['points' => $this->pointsError($e)]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Game.questError'));
        }
    }

    /**
     * Delete a quest: administrators only. The visits and the season points of its walkers stay.
     *
     * DELETE /game/quests/:id
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->isAdmin()) {
            return $this->session->isAuth ? $this->failForbidden() : $this->failUnauthorized();
        }

        $quest = $this->find($id);

        if (!$quest) {
            return $this->failNotFound(lang('Game.questNotFound'));
        }

        (new QuestsModel())->delete($quest->id);

        return $this->respondDeleted(['id' => $quest->id]);
    }

    /**
     * Start walking a quest: from then on a photo uploaded to one of its places counts as its
     * point too. "I am here" starts the walk by itself.
     *
     * POST /game/quests/:id/start → { id, started, finished, confirmed }; 400 with
     * QuestsLibrary::ACTIVE_MAX quests begun and not finished
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function start($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        $quest = $this->find($id);

        if (!$quest) {
            return $this->failNotFound(lang('Game.questNotFound'));
        }

        try {
            $this->quests->start($this->session->user->id, $quest->id);

            return $this->respond($this->quests->walksOf($this->session->user->id, [$quest->id])[$quest->id]);
        } catch (\OverflowException) {
            return $this->failValidationErrors(['error' => lang('Game.questsActiveMax', [QuestsLibrary::ACTIVE_MAX])]);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Game.questError'));
        }
    }

    /**
     * Give up the walk of a quest begun and not finished (QuestsLibrary::leave()): the quest is
     * as before it was begun; the visits made on it stay.
     *
     * DELETE /game/quests/:id/walk → 204, 400 when it is walked to the end, 404 when not begun
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function leave($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        $quest = $this->find($id);

        if (!$quest) {
            return $this->failNotFound(lang('Game.questNotFound'));
        }

        $walk = $this->quests->walksOf($this->session->user->id, [$quest->id])[$quest->id] ?? null;

        if (!$walk) {
            return $this->failNotFound(lang('Game.questNotStarted'));
        }

        if ($walk['finished']) {
            return $this->failValidationErrors(lang('Game.questFinished'));
        }

        try {
            $this->quests->leave($this->session->user->id, $quest->id);

            return $this->respondNoContent();
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Game.questError'));
        }
    }

    /**
     * "I am here" at a point of a quest: the position is compared with the point and dropped.
     *
     * POST /game/quests/:id/confirm { lat, lon, accuracy?, point?, visitedAt? }
     *   → { point, place, finished, points, bonus, total } or 400 when the point is far
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function confirm($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        $quest = $this->find($id);

        if (!$quest) {
            return $this->failNotFound(lang('Game.questNotFound'));
        }

        $input    = $this->request->getJSON(true) ?: [];
        $position = Game::position($input);

        if (!$position) {
            return $this->failValidationErrors(lang('Game.badPosition'));
        }

        $day = VisitsLibrary::day($input['visitedAt'] ?? null);

        if ($day === false) {
            return $this->failValidationErrors(lang('Visits.badDate'));
        }

        try {
            $result = $this->quests->confirmHere(
                $this->session->user,
                $quest,
                is_string($input['point'] ?? null) ? $input['point'] : null,
                $position['lat'],
                $position['lon'],
                $position['accuracy'],
                $day
            );
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Game.questError'));
        }

        if (!$result['ok']) {
            if ($result['reason'] === 'not_started') {
                return $this->failValidationErrors(lang('Game.questNotStarted'));
            }

            if ($result['reason'] === 'finished') {
                return $this->failValidationErrors(lang('Game.questFinished'));
            }

            return $this->failValidationErrors(
                isset($result['distance'])
                    ? lang('Game.pointFar', [Game::distanceText($result['distance'], $this->request->getLocale())])
                    : lang($quest->mode === QuestsModel::MODE_PHOTOS ? 'Game.photoFar' : 'Game.riddleFar')
            );
        }

        unset($result['ok']);

        return $this->respond($result);
    }

    private function isAdmin(): bool
    {
        return $this->session->isAuth && $this->session->user?->role === 'admin';
    }

    /** A quest the visitor may see: a published one, a draft for an administrator */
    private function find(mixed $id): ?object
    {
        if (!$id) {
            return null;
        }

        $quest = (new QuestsModel())->find((string) $id);

        if (!$quest || ($quest->status !== QuestsModel::STATUS_PUBLISHED && !$this->isAdmin())) {
            return null;
        }

        return $quest;
    }

    /**
     * The people who walked a quest to the end, the latest first.
     *
     * @return array<int, array<string, mixed>>
     */
    private function walkers(string $questId): array
    {
        $rows = Database::connect()->table('quests_walks w')
            ->select('users.id, users.name, users.avatar')
            ->join('users', 'users.id = w.user_id')
            ->where('w.quest_id', $questId)
            ->where('w.finished_at IS NOT NULL', null, false)
            ->orderBy('w.finished_at', 'DESC')
            ->limit(5)
            ->get()->getResult();

        $avatars = new AvatarLibrary();

        return array_map(static fn ($row) => [
            'id'     => $row->id,
            'name'   => $row->name,
            'avatar' => $avatars->buildPath($row->id, $row->avatar, 'small'),
        ], $rows);
    }

    /**
     * The fields of a quest from the request: checked and trimmed. A quest needs a title in at
     * least one language; an update takes what is sent and keeps the rest.
     *
     * @param array<string, mixed> $input
     * @param object|null          $quest The quest being updated: its title in the language not sent
     * @return array<string, mixed> the columns, or `['errors' => [field => message]]`
     */
    private function fields(array $input, bool $isNew, ?object $quest = null): array
    {
        $data   = [];
        $errors = [];

        foreach (['titleRu' => 'title_ru', 'titleEn' => 'title_en'] as $key => $column) {
            if (!array_key_exists($key, $input)) {
                continue;
            }

            $value = is_string($input[$key]) ? trim(strip_tags($input[$key])) : '';

            if (mb_strlen($value) > self::TITLE_MAX) {
                $errors[$key] = lang('Game.titleLong', [self::TITLE_MAX]);
            }

            $data[$column] = $value === '' ? null : $value;
        }

        // A title in at least one language: the form sends the site's language only, the other
        // one is kept (a bot may send both)
        $sent = array_key_exists('title_ru', $data) || array_key_exists('title_en', $data);

        if ($isNew || $sent) {
            $ru = array_key_exists('title_ru', $data) ? $data['title_ru'] : ($quest->title_ru ?? null);
            $en = array_key_exists('title_en', $data) ? $data['title_en'] : ($quest->title_en ?? null);

            if (empty($ru) && empty($en)) {
                $errors[array_key_exists('title_en', $data) && !array_key_exists('title_ru', $data) ? 'titleEn' : 'titleRu'] = lang('Game.titleRequired');
            }
        }

        foreach (['descriptionRu' => 'description_ru', 'descriptionEn' => 'description_en'] as $key => $column) {
            if (!array_key_exists($key, $input)) {
                continue;
            }

            $value = is_string($input[$key]) ? trim(strip_tags($input[$key])) : '';

            $data[$column] = $value === '' ? null : mb_substr($value, 0, self::DESCRIPTION_MAX);
        }

        if (array_key_exists('mode', $input) || $isNew) {
            if (!in_array($input['mode'] ?? null, QuestsModel::MODES, true)) {
                $errors['mode'] = lang('Game.badMode');
            } else {
                $data['mode'] = $input['mode'];
            }
        }

        if (array_key_exists('status', $input)) {
            if (!in_array($input['status'], [QuestsModel::STATUS_DRAFT, QuestsModel::STATUS_PUBLISHED], true)) {
                $errors['status'] = lang('Game.badStatus');
            } else {
                $data['status'] = $input['status'];
            }
        }

        return $errors ? ['errors' => $errors] : $data;
    }

    /**
     * The words of a rejected list of points: a photo quest's place without a photo, or the
     * number of the places
     */
    private function pointsError(\InvalidArgumentException $e): string
    {
        return $e->getMessage() === 'photos'
            ? lang('Game.photoPointsNoPhoto')
            : lang('Game.badPoints', [QuestsLibrary::POINTS_MIN, QuestsLibrary::POINTS_MAX]);
    }
}
