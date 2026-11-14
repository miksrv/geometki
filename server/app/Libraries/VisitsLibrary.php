<?php

namespace App\Libraries;

use App\Entities\VisitEntity;
use App\Models\PhotosModel;
use App\Models\PlacesModel;
use App\Models\UsersModel;
use App\Models\VisitsModel;
use Config\Database;
use Config\VisitQuestions;
use Throwable;

/**
 * Visits ("I was here"): the rules of a
 * contribution and the API shape of a visit.
 *
 * A bare visit gives no experience (without a location it would be a free farm). A visit
 * with a contribution — photos (the photos its author uploads to the place on the day of the
 * visit are linked to it, photoVisit()), an answer to the questions (step 2,
 * Config\VisitQuestions, table visit_answers) or a confirmation (the game: a photo shot at the
 * place or "I am here", GameLibrary) — is worth MODIFIER_VISIT, at most once per
 * user, place and calendar month of the visit day: the experience is recounted from the log
 * (LevelsLibrary::experience()), never pushed, so a deleted photo or visit takes it back.
 */
class VisitsLibrary
{
    /** "How it is now" counts the agreement over this many years up to the latest answer */
    private const NOW_YEARS = 3;

    /** Earlier years shown as the history of an answer */
    private const HISTORY_YEARS = 3;

    /**
     * The visits with a contribution the user's experience counts: one per place and month.
     */
    public function contributions(string $userId): int
    {
        $row = Database::connect()->query(
            "SELECT COUNT(DISTINCT v.place_id, DATE_FORMAT(v.visited_at, '%Y-%m')) AS cnt
               FROM users_visited_places v
              WHERE v.user_id = ?
                AND (v.confirmed IS NOT NULL
                     OR EXISTS (SELECT 1 FROM photos p WHERE p.visit_id = v.id AND p.deleted_at IS NULL)
                     OR EXISTS (SELECT 1 FROM visit_answers a WHERE a.visit_id = v.id))",
            [$userId]
        )->getRow();

        return (int) ($row->cnt ?? 0);
    }

    /** How many days back a check-in can be dated: yesterday for the visitor's time zone and a day of slack */
    public const DAYS_BACK = 2;

    /**
     * The day of a check-in: `Y-m-d`, a real date, up to DAYS_BACK days before the server's today
     * and a day after it (the visitor's time zone and a day of slack), today without input. False
     * when it is none of that. The window keeps the log honest: a visit is logged when it happens,
     * and a back-dated one would farm the experience of a visit with a contribution.
     */
    public static function day(mixed $input): string|false
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

    /**
     * Checks a person in at a place on a day: the visit of that week when there is one (one per
     * user and place in VisitsModel::REPEAT_DAYS days), a new one otherwise — with its `visit`
     * event (the place's author hears of it, the page shows it) and the photos uploaded that day
     * before it. A hidden visit (VisitsModel::HIDDEN_RIDDLE: a point of a riddle quest,
     * HIDDEN_PHOTO: made by a photo shot at the place) gets no event until it is shown: a
     * riddle's by reveal(), a photo's here — by the person's own check-in in its week, which
     * then counts as a new one (the tap is new, the questions are asked).
     *
     * @param object   $place  `id`, `user_id`
     * @param string   $day    `Y-m-d`
     * @param bool|int $hidden false / 0 for a check-in of the person's own, or a VisitsModel::HIDDEN_* value
     * @return array{0: VisitEntity, 1: bool} the visit and whether it is new
     */
    public function checkIn(string $userId, object $place, string $day, bool|int $hidden = false): array
    {
        $hidden = (int) $hidden;
        $model  = new VisitsModel();
        $visit  = $model->findWithinWindow($userId, $place->id, $day);

        if ($visit) {
            // The photo made the visit quietly; now the person says it themselves
            if (!$hidden && (int) $visit->hidden === VisitsModel::HIDDEN_PHOTO) {
                $model->update($visit->id, ['hidden' => 0]);
                $visit->hidden = 0;

                $this->logVisit($place->id, $visit->id, $place->user_id ?? null);

                return [$visit, true];
            }

            return [$visit, false];
        }

        $visit = new VisitEntity();
        $visit->user_id    = $userId;
        $visit->place_id   = $place->id;
        $visit->visited_at = $day . ' 12:00:00';
        $visit->hidden     = $hidden;

        try {
            $model->insert($visit);
        } catch (\CodeIgniter\Database\Exceptions\DatabaseException $e) {
            // Two taps at once: the unique key let the first one through, this one answers it
            $visit = $model->findWithinWindow($userId, $place->id, $day);

            if (!$visit) {
                throw $e;
            }

            return [$visit, false];
        }

        $id = $model->getLastGeneratedId();

        if (!$hidden) {
            // The place's author hears of it; the page shows the visit; no experience for a bare visit
            $this->logVisit($place->id, $id, $place->user_id ?? null);
        }

        $visit = $model->find($id);

        // The photos uploaded before the tap that day are the visit's: a contribution
        if ($this->adoptPhotos($visit) > 0) {
            $this->afterChange($userId, $place->id);
        }

        return [$visit, true];
    }

    /**
     * Shows the hidden visits of a finished riddle walk: they get their `visit` events and
     * appear among the visitors of their places.
     *
     * @param string[] $visitIds
     */
    public function reveal(array $visitIds): void
    {
        if (!$visitIds) {
            return;
        }

        $model = new VisitsModel();
        $rows  = $model
            ->select('users_visited_places.id, users_visited_places.place_id, places.user_id AS author_id')
            ->join('places', 'places.id = users_visited_places.place_id', 'left')
            ->whereIn('users_visited_places.id', $visitIds)
            ->where('users_visited_places.hidden', VisitsModel::HIDDEN_RIDDLE)
            ->findAll();

        foreach ($rows as $row) {
            $model->update($row->id, ['hidden' => 0]);

            try {
                $this->logVisit($row->place_id, $row->id, $row->author_id ?? null);
            } catch (Throwable $e) {
                log_message('error', '{exception}', ['exception' => $e]);
            }
        }
    }

    /** The `visit` event of a visit; the author of the place, when it has one, hears of it */
    private function logVisit(string $placeId, string $visitId, ?string $authorId): void
    {
        $activity = new ActivityLibrary();

        if ($authorId) {
            $activity->owner($authorId);
        }

        $activity->visit($placeId, $visitId);
    }

    /** An answer older than this is stale: asked again before the known ones */
    private const STALE_YEARS = 1;

    /**
     * The questions a visit asks, PER_VISIT of the category's pool: first the ones the place
     * has no answer to, in the order of the pool (the practical ones first), then the stale
     * (older than STALE_YEARS) and the contested (half or less agree) ones, the oldest first,
     * then the rest, the oldest first; the ones this visit has answered are taken off the
     * share. No randomness: the pool fills up over the visits, and the list is the same
     * while the visitor answers. The features step comes last, whole.
     *
     * @return array<int, array{key: string, values?: string[], features?: string[]}>
     */
    public function questionsFor(?string $category, string $placeId, ?string $visitId): array
    {
        $config = config(VisitQuestions::class);
        $pool   = $config->categories[$category ?? ''] ?? [];

        if (!$pool) {
            return $config->items($category, []);
        }

        $answered = $visitId
            ? array_column(
                Database::connect()->table('visit_answers')->select('question')->where('visit_id', $visitId)->get()->getResultArray(),
                'question'
            )
            : [];
        $answered = array_values(array_filter($answered, static fn (string $key) => $config->feature($key) === null));
        $share    = VisitQuestions::PER_VISIT - count(array_intersect($answered, $pool));

        if ($share <= 0) {
            return $config->items($category, []);
        }

        $known = array_column(
            Database::connect()->table('places_now')
                ->select('question, agree, total, visited_at')
                ->where('place_id', $placeId)
                ->whereIn('question', $pool)
                ->get()->getResultArray(),
            null,
            'question'
        );
        $stale = date('Y-m-d', strtotime('-' . self::STALE_YEARS . ' years'));
        $rank  = [];

        foreach (array_values(array_diff($pool, $answered)) as $position => $key) {
            $row = $known[$key] ?? null;

            if (!$row) {
                $rank[$key] = [0, $position];
            } elseif ($row['visited_at'] < $stale || (int) $row['agree'] * 2 <= (int) $row['total']) {
                $rank[$key] = [1, (string) $row['visited_at']];
            } else {
                $rank[$key] = [2, (string) $row['visited_at']];
            }
        }

        uasort($rank, static fn (array $a, array $b) => $a <=> $b);

        return $config->items($category, array_slice(array_keys($rank), 0, $share));
    }

    /**
     * Saves the answers of a visit: `question => value` sets one, `question => null` removes
     * it. Every key and value must be allowed for the place's category.
     *
     * @param array<string, string|null> $answers
     * @throws \InvalidArgumentException For a question or value the category does not take
     */
    public function saveAnswers(VisitEntity $visit, array $answers, ?string $category): void
    {
        $config = config(VisitQuestions::class);
        $db     = Database::connect();
        $table  = $db->table('visit_answers');

        foreach ($answers as $question => $value) {
            $ok = $value === null
                ? $config->asks($category, (string) $question)
                : $config->allows($category, (string) $question, (string) $value);

            if (!$ok) {
                throw new \InvalidArgumentException((string) $question);
            }
        }

        $db->transException(true)->transStart();

        try {
            foreach ($answers as $question => $value) {
                $table->where(['visit_id' => $visit->id, 'question' => $question])->delete();

                if ($value !== null) {
                    $table->insert([
                        'visit_id'   => $visit->id,
                        'question'   => $question,
                        'value'      => $value,
                        'created_at' => date('Y-m-d H:i:s'),
                    ]);
                }
            }

            $db->transComplete();
        } finally {
            // The connection is shared: later transactions of the request keep the default
            $db->transException(false);
        }
    }

    /**
     * "How it is now" of a place as the API sends it, from `places_now`: per answer key the
     * latest value, how many people of the NOW_YEARS up to it agree, the earlier years.
     *
     * @return array<int, array{question: string, value: string, visitedAt: string, agree: int, total: int, history: array<int, array{year: int, value: string}>}>
     */
    public function now(string $placeId): array
    {
        $rows = Database::connect()->table('places_now')
            ->select('question, value, agree, total, visited_at, history')
            ->where('place_id', $placeId)
            ->get()->getResultArray();

        $byKey = array_column($rows, null, 'question');
        $items = [];

        // In the order of the config: the questions, then the features
        foreach (config(VisitQuestions::class)->keys() as $key) {
            if (!isset($byKey[$key])) {
                continue;
            }

            $row     = $byKey[$key];
            $items[] = [
                'question'  => $key,
                'value'     => $row['value'],
                'visitedAt' => (string) $row['visited_at'],
                'agree'     => (int) $row['agree'],
                'total'     => (int) $row['total'],
                'history'   => $row['history'] ? (json_decode((string) $row['history'], true) ?: []) : [],
            ];
        }

        return $items;
    }

    /**
     * Recounts `places_now` of a place from the answers of its visits: per answer key the
     * latest answer, how many people of the NOW_YEARS up to it agree (each person by their own
     * latest answer, so a daily visitor counts once), and the latest value of each earlier year
     * as history. Called after every answer and every deleted visit.
     */
    public function rebuildNow(string $placeId): void
    {
        $db   = Database::connect();
        $rows = $db->query(
            'SELECT a.question, a.value, v.user_id, DATE(v.visited_at) AS day
               FROM visit_answers a
               JOIN users_visited_places v ON v.id = a.visit_id
              WHERE v.place_id = ?
              ORDER BY v.visited_at DESC, a.created_at DESC',
            [$placeId]
        )->getResultArray();

        $byQuestion = [];

        foreach ($rows as $row) {
            $byQuestion[$row['question']][] = $row;
        }

        $now    = date('Y-m-d H:i:s');
        $result = [];

        foreach ($byQuestion as $question => $answers) {
            $latest  = $answers[0];
            $year    = (int) substr($latest['day'], 0, 4);
            $since   = date('Y-m-d', strtotime($latest['day'] . ' -' . self::NOW_YEARS . ' years'));
            $window  = [];

            // Rows are newest first: the first row of a person is their latest answer
            foreach ($answers as $row) {
                if ($row['day'] > $since && !isset($window[$row['user_id']])) {
                    $window[$row['user_id']] = $row;
                }
            }

            $agree   = count(array_filter($window, static fn (array $row) => $row['value'] === $latest['value']));
            $history = [];

            // Rows are newest first: the first row of an earlier year is its latest answer
            foreach ($answers as $row) {
                $rowYear = (int) substr($row['day'], 0, 4);

                if ($rowYear < $year && !isset($history[$rowYear]) && count($history) < self::HISTORY_YEARS) {
                    $history[$rowYear] = ['year' => $rowYear, 'value' => $row['value']];
                }
            }

            $result[] = [
                'place_id'   => $placeId,
                'question'   => $question,
                'value'      => $latest['value'],
                'agree'      => $agree,
                'total'      => count($window),
                'visited_at' => $latest['day'],
                'history'    => $history ? json_encode(array_values($history)) : null,
                'source'     => 'visits',
                'updated_at' => $now,
            ];
        }

        $db->transException(true)->transStart();

        try {
            // The rows of the visits go, and the rows of another source the visits now answer
            // (the key is one row per place and question: the visitors' answer is the fresher one)
            $builder = $db->table('places_now')->where('place_id', $placeId);

            if ($result) {
                $builder->groupStart()->where('source', 'visits')->orWhereIn('question', array_column($result, 'question'))->groupEnd();
            } else {
                $builder->where('source', 'visits');
            }

            $builder->delete();

            if ($result) {
                $db->table('places_now')->insertBatch($result);
            }

            $db->transComplete();
        } finally {
            $db->transException(false);
        }
    }

    /**
     * The visit a photo uploaded now belongs to: the uploader's latest visit of the place
     * within a day of today (the visit day is the visitor's own, a day off the server's), or
     * none. Nothing is asked in the upload form: a check-in and the photos of the trip go
     * together by the day.
     */
    public function photoVisit(?string $userId, string $placeId): ?VisitEntity
    {
        if (!$userId) {
            return null;
        }

        return (new VisitsModel())
            ->where(['user_id' => $userId, 'place_id' => $placeId])
            ->where('DATE(visited_at) >=', date('Y-m-d', strtotime('-1 day')))
            ->where('DATE(visited_at) <=', date('Y-m-d', strtotime('+1 day')))
            ->orderBy('visited_at', 'DESC')
            ->first();
    }

    /**
     * The photos the visitor uploaded to the place within a day of a new visit, before the
     * tap, become the visit's (the photos of the trip and the check-in come in any order).
     *
     * @return int how many photos were adopted
     */
    public function adoptPhotos(VisitEntity $visit): int
    {
        $day = substr((string) $visit->visited_at, 0, 10);

        return (int) (new PhotosModel())->builder()
            ->set('visit_id', $visit->id)
            ->where([
                'user_id'  => $visit->user_id,
                'place_id' => $visit->place_id,
                'visit_id' => null,
            ])
            ->where('deleted_at', null)
            ->where('created_at >=', date('Y-m-d 00:00:00', strtotime($day . ' -1 day')))
            ->where('created_at <=', date('Y-m-d 23:59:59', strtotime($day . ' +1 day')))
            ->update() ? Database::connect()->affectedRows() : 0;
    }

    /**
     * After a visit gained or lost something: "how it is now", the experience (a contribution
     * may have appeared), the achievements and the place page.
     */
    public function afterChange(string $userId, string $placeId): void
    {
        // The answer or the photo is saved already: what follows must not fail the request
        try {
            $this->rebuildNow($placeId);
            SitePages::place($placeId);
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }

        try {
            $user = (new UsersModel())->select('id, experience, level')->find($userId);

            if (!$user) {
                return;
            }

            $before = (int) $user->experience;
            (new LevelsLibrary())->calculate($user);

            // The visit metrics move on a check-in (ActivityLibrary checks them then); an
            // answer or a photo moves only the experience, and only the first of the month does
            if ((int) $user->experience !== $before) {
                (new AchievementsLibrary())->check($userId, 'visit');
            }
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }
    }

    /**
     * Visit rows (with `user_name`, `user_avatar` joined when $withAuthor) as the API sends them.
     *
     * @param object[] $rows
     * @return array<int, array<string, mixed>>
     */
    public function format(array $rows, string $locale, bool $withAuthor = true, bool $withPlace = false): array
    {
        if (!$rows) {
            return [];
        }

        $photos  = $this->photosOf(array_column($rows, 'id'), $locale);
        $answers = $this->answersOf(array_column($rows, 'id'));
        $places  = $withPlace ? (new PlaceFormatterLibrary())->listItems(array_values(array_unique(array_column($rows, 'place_id'))), $locale) : [];
        $avatars = new AvatarLibrary();
        $items   = [];

        foreach ($rows as $row) {
            $item = [
                'id'        => $row->id,
                'visitedAt' => substr((string) $row->visited_at, 0, 10),
                'created'   => $row->created_at ? new \DateTime((string) $row->created_at) : null,
                'photos'    => $photos[$row->id] ?? [],
                'answers'   => (object) ($answers[$row->id] ?? []),
            ];

            // The game: how the visit was proved (`photo`, `geo`)
            if (!empty($row->confirmed)) {
                $item['confirmed'] = $row->confirmed;
            }

            if ($withAuthor && !empty($row->user_id)) {
                $item['author'] = [
                    'id'     => $row->user_id,
                    'name'   => $row->user_name ?? null,
                    'avatar' => $avatars->buildPath($row->user_id, $row->user_avatar ?? null, 'small'),
                ];
            }

            if ($withPlace && isset($places[$row->place_id])) {
                $item['place'] = $places[$row->place_id];
            }

            $items[] = $item;
        }

        return $items;
    }

    /**
     * @param string[] $visitIds
     * @return array<string, array<string, string>> visit id => question => value
     */
    private function answersOf(array $visitIds): array
    {
        if (!$visitIds) {
            return [];
        }

        $rows = Database::connect()->table('visit_answers')
            ->select('visit_id, question, value')
            ->whereIn('visit_id', $visitIds)
            ->get()->getResultArray();

        $result = [];

        foreach ($rows as $row) {
            $result[$row['visit_id']][$row['question']] = $row['value'];
        }

        return $result;
    }

    /**
     * @param string[] $visitIds
     * @return array<string, array<int, array<string, mixed>>> visit id => photos
     */
    private function photosOf(array $visitIds, string $locale): array
    {
        if (!$visitIds) {
            return [];
        }

        $rows = (new PhotosModel())
            ->asArray()
            ->select('id, visit_id, place_id, filename, extension, width, height, title_ru, title_en, created_at')
            ->whereIn('visit_id', $visitIds)
            ->orderBy('created_at', 'ASC')
            ->findAll();

        $result = [];

        foreach ($rows as $row) {
            $path = PATH_PHOTOS . $row['place_id'] . '/' . $row['filename'];

            $result[$row['visit_id']][] = [
                'id'      => $row['id'],
                'full'    => $path . '.' . $row['extension'],
                'preview' => $path . '_preview.' . $row['extension'],
                'width'   => (int) $row['width'],
                'height'  => (int) $row['height'],
                'title'   => $locale === 'ru' ? ($row['title_ru'] ?: $row['title_en']) : ($row['title_en'] ?: $row['title_ru']),
                'placeId' => $row['place_id'],
            ];
        }

        return $result;
    }
}
