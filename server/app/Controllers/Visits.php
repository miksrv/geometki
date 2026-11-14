<?php

namespace App\Controllers;

use App\Entities\VisitEntity;
use App\Libraries\ActivityRemoval;
use App\Libraries\AvatarLibrary;
use App\Libraries\GameLibrary;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\QuestsLibrary;
use App\Libraries\SessionLibrary;
use App\Libraries\VisitsLibrary;
use App\Models\ActivityModel;
use App\Models\PlacesModel;
use App\Models\VisitsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;
use Throwable;

/**
 * Visits controller: the log of check-ins ("I was here").
 *
 * A visit is repeatable (one per user, place and day) and is made in one tap; with the game
 * the tap also brings the visitor's position, compared with the place and never stored (a
 * check-in on the spot counts the place in the season); the photos its author uploads to the place that day are its (VisitsLibrary::photoVisit()),
 * and it answers the one-tap questions of the place's category (Config\VisitQuestions).
 * The public lists are in the guest cache (`visits` group); `GET /visits/me` answers a guest
 * with nothing.
 *
 * @package App\Controllers
 */
class Visits extends ResourceController
{
    private const LIMIT_DEFAULT = 10;

    private const LIMIT_MAX = 40;

    protected SessionLibrary $session;

    protected VisitsLibrary $visits;

    public function __construct()
    {
        $this->session = new SessionLibrary();
        $this->visits  = new VisitsLibrary();
    }

    /** The faces in the "Где это" card: the latest distinct visitors of a place */
    private const VISITORS = 5;

    /**
     * The visits of a place, or of a person, newest first by the visit day.
     *
     * GET /visits?place=:id  → { items, count, people, last, visitors, now }
     * GET /visits?user=:id   → { items, count }, every item with its place
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $placeId = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS);
        $userId  = $this->request->getGet('user', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$placeId && !$userId) {
            return $this->failValidationErrors(lang('Visits.missingPlaceId'));
        }

        [$limit, $offset] = $this->pagination();

        $model = $this->listQuery($placeId ?: null, $userId ?: null);

        // A visit of a riddle quest's point is its author's secret until the walk is over
        if (!$userId || $userId !== $this->session->user?->id) {
            $model->where('users_visited_places.hidden', 0);
        } else {
            // A visit a photo made is no check-in of theirs yet
            $model->where('users_visited_places.hidden !=', VisitsModel::HIDDEN_PHOTO);
        }

        // No reset: a clone of the model shares its builder, the count must leave the filters for the page
        $count = $model->countAllResults(false);
        $rows  = $model
            ->orderBy('users_visited_places.visited_at', 'DESC')
            ->orderBy('users_visited_places.created_at', 'DESC')
            ->findAll($limit, $offset);

        $answer = [
            'items' => $this->visits->format($rows, $this->request->getLocale(), true, (bool) $userId),
            'count' => $count,
        ];

        if ($placeId) {
            $summary = (new VisitsModel())
                ->select('COUNT(DISTINCT user_id) AS people, MAX(visited_at) AS last', false)
                ->where('place_id', $placeId)
                ->where('hidden', 0)
                ->first();

            $answer['people']   = (int) ($summary->people ?? 0);
            $answer['last']     = $summary->last ? substr((string) $summary->last, 0, 10) : null;
            $answer['visitors'] = $this->visitors($placeId);
            $answer['now']      = $this->visits->now($placeId);
        }

        return $this->respond($answer);
    }

    /**
     * The distinct places a person visited, the latest visit first: the "places" view of
     * the profile's visits tab.
     *
     * GET /visits/places?user=:id&limit&offset
     *
     * @return ResponseInterface
     */
    public function places(): ResponseInterface
    {
        $userId = $this->request->getGet('user', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$userId) {
            return $this->failValidationErrors(lang('Visits.missingUserId'));
        }

        [$limit, $offset] = $this->pagination();

        // Deleted places are left out of the count as of the items
        $visited = (new VisitsModel())
            ->asArray()
            ->select('users_visited_places.place_id, MAX(users_visited_places.visited_at) AS last', false)
            ->join('places', 'places.id = users_visited_places.place_id AND places.deleted_at IS NULL')
            ->where('users_visited_places.user_id', $userId)
            ->where('users_visited_places.hidden <=', $userId === $this->session->user?->id ? 1 : 0)
            ->groupBy('users_visited_places.place_id')
            ->orderBy('last', 'DESC')
            ->findAll();

        $placeIds = array_column($visited, 'place_id');

        if (!$placeIds) {
            return $this->respond(['items' => [], 'count' => 0]);
        }

        $pageIds = array_slice($placeIds, $offset, $limit);

        $placesModel = new PlacesModel();
        $placesModel->applyListSelect();
        $rows = $pageIds ? $placesModel->whereIn('places.id', $pageIds)->get()->getResult() : [];

        $content = new PlacesContent(350);
        $content->translate(array_column($rows, 'id'));

        $locale    = $this->request->getLocale();
        $formatter = new PlaceFormatterLibrary();
        $byId      = [];

        foreach ($rows as $place) {
            $formatter->formatListRow(
                $place,
                $locale,
                $content->title($place->id),
                strip_tags(html_entity_decode((string) $content->content($place->id), ENT_QUOTES | ENT_HTML5, 'UTF-8'))
            );
            $byId[$place->id] = $place;
        }

        // In the order of the latest visit, deleted places left out
        $items = array_values(array_filter(array_map(static fn ($id) => $byId[$id] ?? null, $pageIds)));

        $formatter->markVisitorState($items, $this->session->user?->id);

        return $this->respond(['items' => $items, 'count' => count($placeIds)]);
    }

    /**
     * The signed-in visitor's own visits of a place, with the questions their latest visit asks,
     * however old (one who checked in before the questions came is asked too): the state of the
     * "I was here" button and the questions block, asked in the browser (the place page is
     * cached without a visitor).
     *
     * GET /visits/me?place=:id → { items, count, questions: [{ key, values }, …, { key: 'can', features }], repeatDays }
     *
     * @return ResponseInterface
     */
    public function me(): ResponseInterface
    {
        $placeId = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$this->session->isAuth || !$this->session->user || !$placeId) {
            return $this->respond(['items' => [], 'count' => 0, 'questions' => [], 'repeatDays' => VisitsModel::REPEAT_DAYS]);
        }

        $place = (new PlacesModel())->select('id, category')->find($placeId);
        $rows  = $this->listQuery($placeId, $this->session->user->id)
            // A visit a photo made is not the visitor's check-in: the button is not pressed, nothing is asked
            ->where('users_visited_places.hidden !=', VisitsModel::HIDDEN_PHOTO)
            ->orderBy('users_visited_places.visited_at', 'DESC')
            ->orderBy('users_visited_places.created_at', 'DESC')
            ->findAll();

        // The visit the questions are for: the latest one
        $current = $rows[0] ?? null;

        $answer = [
            'items'     => $this->visits->format($rows, $this->request->getLocale()),
            'count'     => count($rows),
            'questions' => $place ? $this->visits->questionsFor($place->category, $place->id, $current?->id) : [],
            // The latest visit younger than this is the one a tap cancels
            'repeatDays' => VisitsModel::REPEAT_DAYS,
        ];

        // The game: what a confirmed visit of the place gives now
        if ($place) {
            $answer['game'] = $this->gameOf($place);
        }

        return $this->respond($answer);
    }

    /**
     * The place in the game for the visitor: the points a confirmation gives now ("I am here";
     * a photo adds its bonus), how near "near" is, and their own score of the season there.
     *
     * @return array<string, mixed>|null null outside a season that takes confirmations
     */
    private function gameOf(object $place): ?array
    {
        $game   = new GameLibrary();
        $config = config(\Config\Game::class);
        $season = $game->openSeason(date('Y-m-d'));

        if (!$season) {
            return null;
        }

        $value = $game->values([$place], $season, $this->session->user->id)[$place->id];

        return [
            'season'     => $season['id'],
            'points'     => $value['points'],
            'position'   => $value['position'],
            'photoBonus' => $config->photoBonus,
            'radius'     => $config->radiusOf($place->category),
            // The visitor's score of the season at this place: counted once
            'earned'     => $value['earned'],
            'way'        => $value['way'],
        ];
    }

    /**
     * The answers to the questions of a visit: `{ answers: { road: 'dirt', entry: null } }`,
     * a value sets, null removes. Author only; the keys and values are those of the place's
     * category (Config\VisitQuestions).
     *
     * PATCH /visits/:id { answers }
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function update($id = null): ResponseInterface
    {
        $input = $this->request->getJSON(true);

        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        $model = new VisitsModel();
        $visit = $id ? $model->find($id) : null;

        if (!$visit) {
            return $this->failNotFound(lang('Visits.notFound'));
        }

        if ($visit->user_id !== $this->session->user->id) {
            return $this->failForbidden(lang('Visits.forbidden'));
        }

        $answers = $input['answers'] ?? null;

        if (!is_array($answers) || !$answers) {
            return $this->failValidationErrors(lang('Visits.badAnswer'));
        }

        foreach ($answers as $question => $value) {
            if (!is_string($question) || ($value !== null && !is_string($value))) {
                return $this->failValidationErrors(lang('Visits.badAnswer'));
            }
        }

        $place = (new PlacesModel())->select('id, category')->find($visit->place_id);

        try {
            $this->visits->saveAnswers($visit, $answers, $place?->category);
        } catch (\InvalidArgumentException) {
            return $this->failValidationErrors(lang('Visits.badAnswer'));
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Visits.error'));
        }

        try {
            // An answer is a contribution: the experience, the achievements, the place page
            $this->visits->afterChange($visit->user_id, $visit->place_id);

            return $this->respond($this->answer($visit));
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Visits.error'));
        }
    }

    /**
     * Check in, the one "I was here" of the site: creates the visit, or answers the one of that
     * week (one per user and place in VisitsModel::REPEAT_DAYS days, so a resend from the offline
     * queue cannot create a duplicate; the client turns a second tap in the week into cancelling
     * the visit, DELETE).
     *
     * With the visitor's position (`lat`, `lon`, `accuracy?` — the browser's answer to the tap)
     * a check-in near the place is a confirmed one: the place counts
     * in the season (GameLibrary::confirm()). The position is compared with the place and
     * dropped. Far from the place, or without a position, it is a plain visit — never an error.
     *
     * POST /visits { place, visitedAt?, lat?, lon?, accuracy? } — auth required. `visitedAt` is
     * the visitor's day, `Y-m-d`, within a day of the server's today (the time zones); today
     * without it. 201 with the visit and `isNew: true`; 200 with the existing one; with the game,
     * `game: { confirmed, points, far? }` — whether this check-in counted the place, the season
     * points it added, how far the place is when the position was not near. The photos the
     * visitor uploaded to the place that day before the tap become the visit's
     * (VisitsLibrary::adoptPhotos()).
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function create(): ResponseInterface
    {
        $input = $this->request->getJSON();

        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        if (empty($input) || empty($input->place) || !is_string($input->place)) {
            return $this->failValidationErrors(lang('Visits.missingPlaceId'));
        }

        $day = VisitsLibrary::day($input->visitedAt ?? null);

        if ($day === false) {
            return $this->failValidationErrors(lang('Visits.badDate'));
        }

        $place = (new PlacesModel())->select('id, user_id, category, lat, lon, created_at')->find($input->place);

        if (!$place) {
            return $this->failNotFound(lang('Visits.placeNotFound'));
        }

        $userId = $this->session->user->id;
        // The position is the visitor's answer to the tap: used for this comparison and dropped
        $position = Game::position((array) $input);
        $game     = ['confirmed' => false, 'points' => 0];
        $near     = false;

        try {
            if ($position) {
                $library = new GameLibrary();

                [$near, $distance] = $library->isNear($place, $position['lat'], $position['lon'], $position['accuracy']);

                if (!$near) {
                    $game['far'] = Game::distanceText($distance, $this->request->getLocale());
                }
            }

            if ($position && $near) {
                $result = $library->confirm($userId, $place, GameLibrary::WAY_GEO, $day);

                (new QuestsLibrary())->placeConfirmed($userId, $place->id, $result['visit']->id);

                [$visit, $isNew] = [$result['visit'], $result['isNew']];
                $game            = ['confirmed' => true, 'points' => $result['points']];
            } else {
                [$visit, $isNew] = $this->visits->checkIn($userId, $place, $day);
            }

            $answer         = $this->answer($visit, $isNew);
            $answer['game'] = $game;

            return $isNew ? $this->respondCreated($answer) : $this->respond($answer);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Visits.error'));
        }
    }

    /**
     * Delete a visit: the author or an admin. Its photos stay with the place, its `visit`
     * event goes (ActivityRemoval brings the feed and the experience in line).
     *
     * DELETE /visits/:id
     *
     * @param string|null $id
     *
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user) {
            return $this->failUnauthorized();
        }

        $model = new VisitsModel();
        $visit = $id ? $model->find($id) : null;

        if (!$visit) {
            return $this->failNotFound(lang('Visits.notFound'));
        }

        if ($visit->user_id !== $this->session->user->id && $this->session->user->role !== 'admin') {
            return $this->failForbidden(lang('Visits.forbidden'));
        }

        try {
            $removal = ActivityRemoval::forVisit($visit->id)->by($this->session->user->id);

            // The game: the season points of the visit go with it, while its season is open
            (new GameLibrary())->visitDeleted($visit->id);

            (new ActivityModel())->where('visit_id', $visit->id)->delete();
            $model->delete($visit->id);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Visits.error'));
        }

        // The visit is gone: nothing below fails the request. afterChange() recounts the
        // author's experience too, for a visit whose event the removal did not find
        $removal->apply();
        $this->visits->afterChange($visit->user_id, $visit->place_id);

        return $this->respondDeleted(['id' => $visit->id]);
    }

    /**
     * A visit as the API sends it, with the author; a created one also says which visit
     * of the place it is and whether it opens the year there.
     *
     * @return array<string, mixed>
     */
    private function answer(VisitEntity $visit, ?bool $isNew = null): array
    {
        $row = $this->listQuery(null, null)->where('users_visited_places.id', $visit->id)->first();

        $item = $this->visits->format($row ? [$row] : [], $this->request->getLocale())[0] ?? ['id' => $visit->id];

        if ($isNew !== null) {
            $model = new VisitsModel();
            $day   = substr((string) $visit->visited_at, 0, 10);

            $visitedAt = (string) $visit->visited_at;

            // Which visit of the place this one is, by the day, then by the moment it was logged
            $item['isNew']   = $isNew;
            $item['ordinal'] = $model
                ->where('place_id', $visit->place_id)
                ->groupStart()
                    ->where('visited_at <', $visitedAt)
                    ->orGroupStart()
                        ->where('visited_at', $visitedAt)
                        ->where('created_at <=', (string) $visit->created_at)
                    ->groupEnd()
                ->groupEnd()
                ->countAllResults();
            // Nobody before it this year: by the day, then by the moment (the same tie-break as
            // the `first_visit_of_year` metric), so a re-POST answers the same as the first one
            $item['firstThisYear'] = $model
                    ->where('place_id', $visit->place_id)
                    ->where('id !=', $visit->id)
                    ->where('visited_at >=', substr($day, 0, 4) . '-01-01 00:00:00')
                    ->groupStart()
                        ->where('visited_at <', $visitedAt)
                        ->orGroupStart()
                            ->where('visited_at', $visitedAt)
                            ->where('created_at <', (string) $visit->created_at)
                        ->groupEnd()
                    ->groupEnd()
                    ->countAllResults() === 0;
        }

        return $item;
    }

    /**
     * The people who checked in at the place, the latest first, with the name and avatar.
     *
     * @return array<int, array<string, mixed>>
     */
    private function visitors(string $placeId): array
    {
        $rows = (new VisitsModel())
            ->asArray()
            ->select('users_visited_places.user_id, users.name, users.avatar, MAX(users_visited_places.visited_at) AS last', false)
            ->join('users', 'users.id = users_visited_places.user_id', 'left')
            ->where('users_visited_places.place_id', $placeId)
            ->where('users_visited_places.hidden', 0)
            ->groupBy('users_visited_places.user_id, users.name, users.avatar')
            ->orderBy('last', 'DESC')
            ->findAll(self::VISITORS);

        $avatars = new AvatarLibrary();

        return array_map(static fn (array $row) => [
            'id'     => $row['user_id'],
            'name'   => $row['name'],
            'avatar' => $avatars->buildPath($row['user_id'], $row['avatar'], 'small'),
        ], $rows);
    }

    /**
     * Visits with their author's name and avatar.
     */
    private function listQuery(?string $placeId, ?string $userId): VisitsModel
    {
        $model = (new VisitsModel())
            ->select('users_visited_places.*, users.name AS user_name, users.avatar AS user_avatar')
            ->join('users', 'users.id = users_visited_places.user_id', 'left');

        if ($placeId) {
            $model->where('users_visited_places.place_id', $placeId);
        }

        if ($userId) {
            $model->where('users_visited_places.user_id', $userId);
        }

        return $model;
    }

    /**
     * @return array{int, int} limit, offset
     */
    private function pagination(): array
    {
        $limit  = abs((int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? self::LIMIT_DEFAULT));
        $offset = abs((int) ($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0));

        return [min($limit ?: self::LIMIT_DEFAULT, self::LIMIT_MAX), $offset];
    }
}
