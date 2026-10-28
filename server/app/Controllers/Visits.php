<?php

namespace App\Controllers;

use App\Entities\VisitEntity;
use App\Libraries\ActivityLibrary;
use App\Libraries\ActivityRemoval;
use App\Libraries\AvatarLibrary;
use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Libraries\VisitsLibrary;
use App\Models\ActivityModel;
use App\Models\PlacesModel;
use App\Models\VisitsModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;
use Throwable;

/**
 * Visits controller: the log of check-ins ("I was here"), features/25-visits-and-exploration.md, step 1.
 *
 * A visit is repeatable (one per user, place and day), asks no location and is made in one
 * tap; the photos its author uploads to the place that day are its (VisitsLibrary::photoVisit()),
 * and it answers the one-tap questions of the place's category (Config\VisitQuestions, step 2).
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
     * GET /visits/me?place=:id → { items, count, questions: [{ key, values }, …, { key: 'can', features }] }
     *
     * @return ResponseInterface
     */
    public function me(): ResponseInterface
    {
        $placeId = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$this->session->isAuth || !$this->session->user || !$placeId) {
            return $this->respond(['items' => [], 'count' => 0, 'questions' => []]);
        }

        $place = (new PlacesModel())->select('id, category')->find($placeId);
        $rows  = $this->listQuery($placeId, $this->session->user->id)
            ->orderBy('users_visited_places.visited_at', 'DESC')
            ->orderBy('users_visited_places.created_at', 'DESC')
            ->findAll();

        // The visit the questions are for: the latest one
        $current = $rows[0] ?? null;

        return $this->respond([
            'items'     => $this->visits->format($rows, $this->request->getLocale()),
            'count'     => count($rows),
            'questions' => $place ? $this->visits->questionsFor($place->category, $place->id, $current?->id) : [],
        ]);
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
     * Check in: creates the visit, or answers the one of that day (one per user, place and
     * day, so a second tap and a resend from the offline queue cannot create a duplicate).
     *
     * POST /visits { place, visitedAt? } — auth required. `visitedAt` is the visitor's day,
     * `Y-m-d`, within a day of the server's today (the time zones); today without it. 201 with
     * the visit and `isNew: true`; 200 with the existing one. The photos the visitor uploaded to
     * the place that day before the tap become the visit's (VisitsLibrary::adoptPhotos()).
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

        $day = $this->day($input->visitedAt ?? null);

        if ($day === false) {
            return $this->failValidationErrors(lang('Visits.badDate'));
        }

        $place = (new PlacesModel())->select('id, user_id')->find($input->place);

        if (!$place) {
            return $this->failNotFound(lang('Visits.placeNotFound'));
        }

        $model  = new VisitsModel();
        $userId = $this->session->user->id;
        $visit  = $model->findByDay($userId, $place->id, $day);

        if ($visit) {
            return $this->respond($this->answer($visit, false));
        }

        try {
            $visit = new VisitEntity();
            $visit->user_id    = $userId;
            $visit->place_id   = $place->id;
            $visit->visited_at = $day . ' 12:00:00';

            try {
                $model->insert($visit);
            } catch (DatabaseException $e) {
                // Two taps at once: the unique key let the first one through, this one answers it
                $visit = $model->findByDay($userId, $place->id, $day);

                if (!$visit) {
                    throw $e;
                }

                return $this->respond($this->answer($visit, false));
            }

            $visit->id = $model->getLastGeneratedId();

            // The place's author hears of it; the page shows the visit; no experience for a bare visit
            (new ActivityLibrary())->owner($place->user_id)->visit($place->id, $visit->id);

            // The photos uploaded before the tap that day are the visit's: a contribution
            if ($this->visits->adoptPhotos($model->find($visit->id)) > 0) {
                $this->visits->afterChange($userId, $place->id);
            }

            return $this->respondCreated($this->answer($model->find($visit->id), true));
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
            $removal = ActivityRemoval::forVisit($visit->id);

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

    /** How many days back a visit can be dated: yesterday for the visitor's time zone and a day of slack */
    private const DAYS_BACK = 2;

    /**
     * The visit day: `Y-m-d`, a real date, up to DAYS_BACK days before the server's today and
     * a day after it (the visitor's time zone and a day of slack), today without input. False when it is none of that. The
     * window keeps the log honest: a visit is logged when it happens, and a back-dated one
     * would farm the experience of a visit with a contribution (once per place and month).
     */
    private function day(mixed $input): string|false
    {
        if ($input === null || $input === '') {
            return date('Y-m-d');
        }

        if (!is_string($input) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $input)) {
            return false;
        }

        [$year, $month, $dayOfMonth] = array_map('intval', explode('-', $input));

        if (
            !checkdate($month, $dayOfMonth, $year)
            || $input < date('Y-m-d', strtotime('-' . self::DAYS_BACK . ' days'))
            || $input > date('Y-m-d', strtotime('+1 day'))
        ) {
            return false;
        }

        return $input;
    }
}
