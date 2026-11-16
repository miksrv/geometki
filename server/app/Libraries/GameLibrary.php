<?php

namespace App\Libraries;

use App\Entities\VisitEntity;
use App\Models\VisitsModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use Config\Database;
use Config\Game;
use Throwable;

/**
 * The game (features/26-game-seasons-and-quests.md): the confirmed visit and the seasons.
 *
 * A visit is confirmed by a photo with EXIF (shot near the place, the shot day is the visit's
 * day) or by "I am here" (the visitor's coordinates are compared with the place and dropped).
 * A confirmed place gives season points once a season for a person (`game_points`).
 *
 * A season is made by hand by an administrator (`game_seasons`): its own dates, title,
 * description, picture and four medals; nothing is created by the calendar. The season of a
 * visit is the one whose dates hold the visit day, while it is not closed. A season takes
 * confirmations until Config\Game::$graceDays after its end, then `php spark game:tick` closes
 * it: the table is frozen in `game_results`, and everyone in it has a medal — the first three
 * places gold, silver and bronze, the others the grey one. Seasons never overlap.
 */
class GameLibrary
{
    public const WAY_PHOTO = 'photo';
    public const WAY_GEO   = 'geo';

    /**
     * The pictures of a season and their columns: one picture, the medal of every participant
     * (`participant`, also the season's picture everywhere), and its variants for the places 1–3
     */
    public const IMAGE_KINDS = [
        'participant' => 'medal_participant',
        'gold'        => 'medal_gold',
        'silver'      => 'medal_silver',
        'bronze'      => 'medal_bronze',
    ];

    /** Ids a season cannot have: the words of the game's routes (`game/seasons/manage`, …) */
    public const RESERVED_IDS = ['manage', 'new', 'create', 'image', 'seasons', 'leaders', 'places', 'mine', 'recent', 'exploration', 'confirm', 'users', 'quests'];

    /** The time zone of the game's days: without the visitor's own (`tz` cookie) days are Moscow days */
    public const TIMEZONE = 'Europe/Moscow';

    private Game $config;

    /**
     * The game's day: `Y-m-d` in Moscow, whatever the server's time zone (UTC) says. The only
     * place the game asks for "today".
     *
     * @param int|null $timestamp a moment to name the day of; now by default
     */
    public static function today(?int $timestamp = null, int|string $shift = 0): string
    {
        $day = new \DateTimeImmutable('@' . ($timestamp ?? time()));
        $day = $day->setTimezone(new \DateTimeZone(self::TIMEZONE));

        return $shift ? $day->modify(is_int($shift) ? "{$shift} days" : $shift)->format('Y-m-d') : $day->format('Y-m-d');
    }

    public function __construct()
    {
        $this->config = config(Game::class);
    }

    /**
     * A season as the code works with it: the row of `game_seasons` with `from` / `to` beside
     * the dates, so a place that needs only the days reads `$season['from']`.
     *
     * @return array<string, mixed>
     */
    public static function fromRow(object $row): array
    {
        return [
            'id'                => $row->id,
            'from'              => (string) $row->starts_on,
            'to'                => (string) $row->ends_on,
            'title_ru'          => (string) $row->title_ru,
            'title_en'          => $row->title_en,
            'description_ru'    => $row->description_ru,
            'description_en'    => $row->description_en,
            // The season's picture is the medal of every participant
            'image'             => $row->medal_participant,
            'medal_gold'        => $row->medal_gold,
            'medal_silver'      => $row->medal_silver,
            'medal_bronze'      => $row->medal_bronze,
            'medal_participant' => $row->medal_participant,
            'closed_at'         => $row->closed_at,
            'players'           => (int) $row->players,
            'places'            => (int) $row->places,
        ];
    }

    /**
     * A season by its id, null when there is none.
     *
     * @return array<string, mixed>|null
     */
    public function find(string $id): ?array
    {
        $row = Database::connect()->table('game_seasons')->where('id', $id)->get()->getRow();

        return $row ? self::fromRow($row) : null;
    }

    /**
     * The season whose dates hold a day, null in the days between seasons.
     *
     * @param string $day `Y-m-d`
     * @return array<string, mixed>|null
     */
    public function seasonAt(string $day): ?array
    {
        $row = Database::connect()->table('game_seasons')
            ->where('starts_on <=', $day)
            ->where('ends_on >=', $day)
            ->get()->getRow();

        return $row ? self::fromRow($row) : null;
    }

    /**
     * The season that goes on today.
     *
     * @return array<string, mixed>|null
     */
    public function current(): ?array
    {
        return $this->seasonAt(self::today());
    }

    /**
     * The nearest season that has not started yet.
     *
     * @return array<string, mixed>|null
     */
    public function upcoming(): ?array
    {
        $row = Database::connect()->table('game_seasons')
            ->where('starts_on >', self::today())
            ->orderBy('starts_on', 'ASC')
            ->get()->getRow();

        return $row ? self::fromRow($row) : null;
    }

    /**
     * The seasons, the latest start first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function all(): array
    {
        return array_map(
            [self::class, 'fromRow'],
            Database::connect()->table('game_seasons')->orderBy('starts_on', 'DESC')->get()->getResult()
        );
    }

    /** The last day a season takes confirmations: its photos are uploaded at home */
    public function lastDay(array $season): string
    {
        return date('Y-m-d', strtotime($season['to'] . ' +' . $this->config->graceDays . ' days'));
    }

    /**
     * The season a confirmation of that day counts in: the season whose dates hold the day,
     * while it is not closed and still takes confirmations. Null in the days between seasons.
     *
     * @return array<string, mixed>|null
     */
    public function openSeason(string $day): ?array
    {
        $today = self::today();

        // A day ahead of the game's is the visitor's time zone; further is not a visit
        if ($day > self::today(null, 1)) {
            return null;
        }

        $season = $this->seasonAt($day);

        if (!$season || $season['closed_at'] !== null || $today > $this->lastDay($season)) {
            return null;
        }

        return $season;
    }

    /**
     * The medal of a place in the frozen table: gold, silver and bronze for the first three,
     * the grey one for every other participant.
     *
     * @return 'gold'|'silver'|'bronze'|'participant'
     */
    public static function medalOf(int $place): string
    {
        return [1 => 'gold', 2 => 'silver', 3 => 'bronze'][$place] ?? 'participant';
    }

    /**
     * What the administrator sent for a season, checked: the clean fields to save, or the errors by field.
     * A partial update (`$existing`) checks only what was sent, but the dates always as a pair.
     *
     * A closed season keeps its dates, and so does one past its grace days that the tick has not
     * closed yet (moving its end would reopen it). A season with points keeps its start; its end
     * cannot move before the latest day counted in it, nor before today.
     *
     * @param array<string, mixed>      $input
     * @param array<string, mixed>|null $existing the season being edited, null for a new one
     * @return array{0: array<string, mixed>, 1: array<string, string>} fields, errors
     */
    public function validateSeason(array $input, ?array $existing = null): array
    {
        $db     = Database::connect();
        $fields = [];
        $errors = [];

        if (!$existing) {
            $id = $input['id'] ?? null;

            if (!is_string($id) || !preg_match('/^[a-z0-9][a-z0-9-]{1,15}$/D', $id) || in_array($id, self::RESERVED_IDS, true)) {
                $errors['id'] = lang('Game.seasonBadId');
            } elseif ($this->find($id)) {
                $errors['id'] = lang('Game.seasonIdTaken');
            } else {
                $fields['id'] = $id;
            }
        }

        if (!$existing || array_key_exists('title_ru', $input)) {
            $title = is_string($input['title_ru'] ?? null) ? trim($input['title_ru']) : '';

            if ($title === '') {
                $errors['title_ru'] = lang('Game.seasonTitleRequired');
            } elseif (mb_strlen($title) > 150) {
                $errors['title_ru'] = lang('Game.seasonTitleLong', [150]);
            } else {
                $fields['title_ru'] = $title;
            }
        }

        // The optional texts: a string (empty clears it) or null; anything else is a mistake, not a clear
        if (array_key_exists('title_en', $input)) {
            if ($input['title_en'] !== null && !is_string($input['title_en'])) {
                $errors['title_en'] = lang('Game.seasonBadText');
            } else {
                $title = trim((string) $input['title_en']);

                if (mb_strlen($title) > 150) {
                    $errors['title_en'] = lang('Game.seasonTitleLong', [150]);
                } else {
                    $fields['title_en'] = $title !== '' ? $title : null;
                }
            }
        }

        foreach (['description_ru', 'description_en'] as $key) {
            if (array_key_exists($key, $input)) {
                if ($input[$key] !== null && !is_string($input[$key])) {
                    $errors[$key] = lang('Game.seasonBadText');

                    continue;
                }

                $text = trim((string) $input[$key]);

                if (mb_strlen($text) > 5000) {
                    $errors[$key] = lang('Game.seasonTextLong', [5000]);
                } else {
                    $fields[$key] = $text !== '' ? $text : null;
                }
            }
        }

        $from = array_key_exists('starts_on', $input) || !$existing ? ($input['starts_on'] ?? null) : $existing['from'];
        $to   = array_key_exists('ends_on', $input) || !$existing ? ($input['ends_on'] ?? null) : $existing['to'];

        if (!self::isDay($from)) {
            $errors['starts_on'] = lang('Game.seasonBadDate');
        }

        if (!self::isDay($to)) {
            $errors['ends_on'] = lang('Game.seasonBadDate');
        } elseif (self::isDay($from) && $from > $to) {
            $errors['ends_on'] = lang('Game.seasonDatesOrder');
        }

        if (!isset($errors['starts_on']) && !isset($errors['ends_on'])) {
            $moved = $existing && ($from !== $existing['from'] || $to !== $existing['to']);

            if ($moved && ($existing['closed_at'] !== null || self::today() > $this->lastDay($existing))) {
                $errors['starts_on'] = lang('Game.seasonClosedDates');
            } elseif ($moved && $this->hasPoints($existing['id'])) {
                $counted = $this->lastCountedDay($existing['id']);

                if ($from !== $existing['from']) {
                    $errors['starts_on'] = lang('Game.seasonPointsStart');
                } elseif ($counted !== null && $to < $counted) {
                    $errors['ends_on'] = lang('Game.seasonPointsEnd', [$counted]);
                } elseif ($to < self::today()) {
                    $errors['ends_on'] = lang('Game.seasonPointsEndPast');
                }
            }

            if (!$errors) {
                $other = $db->table('game_seasons')
                    ->where('starts_on <=', $to)
                    ->where('ends_on >=', $from)
                    ->where('id !=', $existing['id'] ?? '')
                    ->get()->getRow();

                if ($other) {
                    $errors['starts_on'] = lang('Game.seasonOverlap', [$other->title_ru !== '' ? $other->title_ru : $other->id]);
                } else {
                    $fields['starts_on'] = $from;
                    $fields['ends_on']   = $to;
                }
            }
        }

        return [$fields, $errors];
    }

    /** Whether anything is counted in a season */
    public function hasPoints(string $seasonId): bool
    {
        return Database::connect()->table('game_points')->where('season', $seasonId)->countAllResults() > 0;
    }

    /**
     * The latest day something is counted in a season: the day of the visit behind a point, the
     * day it was written for one without a visit. Null for a season without points.
     */
    public function lastCountedDay(string $seasonId): ?string
    {
        $row = Database::connect()->table('game_points gp')
            ->select('MAX(DATE(COALESCE(v.visited_at, gp.created_at))) AS day', false)
            ->join('users_visited_places v', 'v.id = gp.visit_id', 'left')
            ->where('gp.season', $seasonId)
            ->get()->getRow();

        return $row && $row->day ? (string) $row->day : null;
    }

    /**
     * Runs a change of the seasons alone: the dates are checked against the other seasons and
     * written under one lock, so two requests do not make overlapping seasons.
     *
     * @return array{0: array<string, mixed>|null, 1: array<string, string>} the season, errors
     */
    private function locked(callable $change): array
    {
        $db  = Database::connect();
        $got = (int) ($db->query("SELECT GET_LOCK('game_seasons', 5) AS l")->getRow()->l ?? 0);

        if (!$got) {
            return [null, ['error' => lang('Game.seasonBusy')]];
        }

        try {
            return $change($db);
        } catch (Throwable $e) {
            // A change that failed halfway leaves nothing open on the connection
            if ($db->transDepth > 0) {
                $db->transRollback();
            }

            throw $e;
        } finally {
            $db->query("SELECT RELEASE_LOCK('game_seasons')");
        }
    }

    /**
     * Makes a season of what the administrator sent.
     *
     * @param array<string, mixed> $input
     * @return array{0: array<string, mixed>|null, 1: array<string, string>} the new season, errors
     */
    public function createSeason(array $input): array
    {
        return $this->locked(function ($db) use ($input) {
            [$fields, $errors] = $this->validateSeason($input);

            if ($errors) {
                return [null, $errors];
            }

            $db->transBegin();

            try {
                $saved = $db->table('game_seasons')->insert($fields + ['created_at' => date('Y-m-d H:i:s')]);
            } catch (DatabaseException $e) {
                $saved = false;
            }

            if (!$saved) {
                $db->transRollback();

                // Another process took the id between the check and the write (MySQL error 1062)
                if ($this->find($fields['id'])) {
                    return [null, ['id' => lang('Game.seasonIdTaken')]];
                }

                return [null, ['error' => lang('Game.seasonError')]];
            }

            $db->transCommit();

            return [$this->find($fields['id']), []];
        });
    }

    /**
     * Changes a season; the row is held while its dates are checked against its points, so a
     * check-in or the tick cannot slip in between.
     *
     * @param array<string, mixed> $input
     * @return array{0: array<string, mixed>|null, 1: array<string, string>} the season (null: it is gone), errors
     */
    public function updateSeason(string $id, array $input): array
    {
        return $this->locked(function ($db) use ($id, $input) {
            $db->transBegin();

            $row = $db->query('SELECT * FROM game_seasons WHERE id = ? FOR UPDATE', [$id])->getRow();

            if (!$row) {
                $db->transRollback();

                return [null, []];
            }

            $season            = self::fromRow($row);
            [$fields, $errors] = $this->validateSeason($input, $season);

            if ($errors) {
                $db->transRollback();

                return [$season, $errors];
            }

            $db->table('game_seasons')->where('id', $id)->update($fields + ['updated_at' => date('Y-m-d H:i:s')]);
            $db->transCommit();

            return [$this->find($id), []];
        });
    }

    /**
     * Deletes a season nobody has played in, the check and the delete in one held row.
     *
     * @return array{0: array<string, mixed>|null, 1: array<string, string>} the deleted season (null: it is gone), errors
     */
    public function deleteSeason(string $id): array
    {
        return $this->locked(function ($db) use ($id) {
            $db->transBegin();

            $row = $db->query('SELECT * FROM game_seasons WHERE id = ? FOR UPDATE', [$id])->getRow();

            if (!$row) {
                $db->transRollback();

                return [null, []];
            }

            $season = self::fromRow($row);

            if ($this->hasPoints($id)) {
                $db->transRollback();

                return [$season, ['error' => lang('Game.seasonHasPoints')]];
            }

            $db->table('game_seasons')->where('id', $id)->delete();
            $db->transCommit();

            return [$season, []];
        });
    }

    /** Whether a value is a real day in `Y-m-d` */
    private static function isDay(mixed $value): bool
    {
        if (!is_string($value)) {
            return false;
        }

        $date = \DateTime::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }

    /** Metres between two points (haversine) */
    public static function distance(float $lat1, float $lon1, float $lat2, float $lon2): int
    {
        $toRad = M_PI / 180;
        $a     = sin(($lat2 - $lat1) * $toRad / 2) ** 2
            + cos($lat1 * $toRad) * cos($lat2 * $toRad) * sin(($lon2 - $lon1) * $toRad / 2) ** 2;

        return (int) round(6371000 * 2 * asin(min(1, sqrt($a))));
    }

    /**
     * Whether a point is near a place: within the radius of its category, plus the reported
     * accuracy of the position (capped).
     *
     * @param object $place `lat`, `lon`, `category`
     * @return array{0: bool, 1: int} near, metres to the place
     */
    public function isNear(object $place, float $lat, float $lon, ?float $accuracy = null): array
    {
        $distance = self::distance((float) $place->lat, (float) $place->lon, $lat, $lon);
        $slack    = $accuracy !== null ? (int) min(max($accuracy, 0), $this->config->accuracySlack) : 0;

        return [$distance <= $this->config->radiusOf($place->category ?? null) + $slack, $distance];
    }

    /**
     * What places are worth to a person in a season: the points the next confirmation gives
     * (as "I am here"; a photo adds the photo bonus), their place in the queue of the season,
     * and the person's own score there when they have one.
     *
     * @param array<int, object> $places rows with `id`, `category`
     * @return array<string, array{points: int, position: int, earned: ?int, way: ?string}> by place id
     */
    public function values(array $places, array $season, ?string $userId): array
    {
        $ids = array_values(array_unique(array_map(static fn ($place) => $place->id, $places)));

        if (!$ids) {
            return [];
        }

        $db = Database::connect();

        $confirmed = array_column(
            $db->table('game_points')
                ->select('place_id, COUNT(*) AS cnt')
                ->where(['season' => $season['id'], 'kind' => 'place'])
                ->whereIn('place_id', $ids)
                ->groupBy('place_id')
                ->get()->getResultArray(),
            'cnt',
            'place_id'
        );

        $mine = $userId
            ? array_column(
                $db->table('game_points')
                    ->select('place_id, points, way')
                    ->where(['season' => $season['id'], 'kind' => 'place', 'user_id' => $userId])
                    ->whereIn('place_id', $ids)
                    ->get()->getResultArray(),
                null,
                'place_id'
            )
            : [];

        $result = [];

        foreach ($places as $place) {
            $position = (int) ($confirmed[$place->id] ?? 0) + 1;

            $result[$place->id] = [
                'points'   => $this->config->placePoints($place->category ?? null, $position),
                'position' => $position,
                'earned'   => isset($mine[$place->id]) ? (int) $mine[$place->id]['points'] : null,
                'way'      => $mine[$place->id]['way'] ?? null,
            ];
        }

        return $result;
    }

    /**
     * Confirms a person's visit of a place on a day: checks them in (the visit of that week, or
     * a new one), marks the visit confirmed and, while the season of the day is open, gives the
     * season points — once a season for the place. A photo after "I am here" adds the photo
     * bonus to the same score.
     *
     * @param object      $place   `id`, `user_id`, `category`, `created_at`
     * @param string      $way     WAY_PHOTO or WAY_GEO
     * @param string      $day     `Y-m-d`: the shot day of the photo, the visitor's day of "I am here"
     * @param string|null $photoId The photo that proves it
     * @param bool|int    $hidden  A VisitsModel::HIDDEN_* value for a visit this confirmation makes: a point of a
     *                             riddle quest (true), a photo (HIDDEN_PHOTO); a visit that exists keeps its own
     *
     * @return array{visit: VisitEntity, isNew: bool, season: ?array, points: int, total: ?int, detail: ?array}
     *         `points` is what this confirmation added (0 when the place was counted already)
     */
    public function confirm(string $userId, object $place, string $way, string $day, ?string $photoId = null, bool|int $hidden = false): array
    {
        $visits = new VisitsLibrary();

        [$visit, $isNew] = $visits->checkIn($userId, $place, $day, $hidden);

        // A photo is the stronger proof: it replaces "I am here", never the other way
        if ($visit->confirmed === null || ($visit->confirmed === self::WAY_GEO && $way === self::WAY_PHOTO)) {
            (new VisitsModel())->update($visit->id, [
                'confirmed'    => $way,
                'confirmed_at' => date('Y-m-d H:i:s'),
            ]);
            $visit->confirmed = $way;
        }

        $season = $this->openSeason($day);
        $added  = 0;
        $detail = null;

        if ($season) {
            [$added, $detail] = $this->score($userId, $place, $season, $way, $visit->id, $photoId, $day);
        }

        // The confirmation is saved: what follows must not fail the request
        try {
            // A confirmed visit is a contribution: the experience is recounted, the page rendered
            $visits->afterChange($userId, $place->id);
            (new AchievementsLibrary())->check($userId, 'game');
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }

        return [
            'visit'  => $visit,
            'isNew'  => $isNew,
            'season' => $season,
            'points' => $added,
            'total'  => $season ? $this->total($userId, $season['id']) : null,
            'detail' => $detail,
        ];
    }

    /**
     * The season score of a place for a person: a new row, or the photo bonus added to the
     * row "I am here" made.
     *
     * @return array{0: int, 1: ?array} the points added, how the score of the place is counted
     */
    private function score(string $userId, object $place, array $season, string $way, string $visitId, ?string $photoId, string $day): array
    {
        $db = Database::connect();

        // The season row is held for sharing while the score is written: the tick (it holds the
        // row for update) waits for a check-in under way, and a check-in that comes after the
        // close finds the season closed and counts nowhere
        $db->transBegin();

        try {
            $row = $db->query('SELECT closed_at, starts_on, ends_on FROM game_seasons WHERE id = ? FOR SHARE', [$season['id']])->getRow();

            // Closed, or its dates changed under the check-in so that they no longer hold the day
            if (!$row || $row->closed_at !== null || $day < $row->starts_on || $day > $row->ends_on) {
                $db->transRollback();

                return [0, null];
            }

            $result = $this->scoreOpen($userId, $place, $season, $way, $visitId, $photoId);
            $db->transCommit();

            return $result;
        } catch (Throwable $e) {
            $db->transRollback();

            throw $e;
        }
    }

    /** score() with the season held */
    private function scoreOpen(string $userId, object $place, array $season, string $way, string $visitId, ?string $photoId): array
    {
        $db    = Database::connect();
        $table = $db->table('game_points');
        $row   = $table->where(['season' => $season['id'], 'user_id' => $userId, 'place_id' => $place->id])->get()->getRow();

        if ($row) {
            $detail = json_decode((string) $row->detail, true) ?: [];

            if ($way !== self::WAY_PHOTO || $row->way === self::WAY_PHOTO) {
                return [0, $detail];
            }

            $bonus  = $this->config->photoBonus + $this->spotBonus($userId, $place, $season);
            // `geo`: "I am here" proved the place first — the score stays when the photo goes
            $detail = array_merge($detail, [
                'photo' => $this->config->photoBonus,
                'spot'  => $bonus - $this->config->photoBonus,
                'geo'   => true,
            ]);

            // Two photos uploaded at once: only the first one finds the row still without a photo
            $db->table('game_points')->where(['id' => $row->id, 'way' => self::WAY_GEO])->update([
                'way'      => self::WAY_PHOTO,
                'photo_id' => $photoId,
                'points'   => (int) $row->points + $bonus,
                'detail'   => json_encode($detail),
            ]);

            if (!$db->affectedRows()) {
                return [0, $detail];
            }

            return [$bonus, $detail];
        }

        $position = $db->table('game_points')
            ->where(['season' => $season['id'], 'kind' => 'place', 'place_id' => $place->id])
            ->countAllResults() + 1;

        $detail = [
            'base'     => $this->config->base,
            'category' => $this->config->categoryFactor($place->category ?? null),
            'order'    => $this->config->orderFactor($position),
            'position' => $position,
            'photo'    => $way === self::WAY_PHOTO ? $this->config->photoBonus : 0,
            'spot'     => $way === self::WAY_PHOTO ? $this->spotBonus($userId, $place, $season) : 0,
        ];
        $points = $this->config->placePoints($place->category ?? null, $position) + $detail['photo'] + $detail['spot'];

        // `ignore`: two confirmations at once — the unique key lets the first one through, the
        // second writes nothing (and does not spoil the held season row)
        $db->table('game_points')->ignore(true)->insert([
            'id'         => substr(bin2hex(random_bytes(7)), 0, 13),
            'season'     => $season['id'],
            'user_id'    => $userId,
            'kind'       => 'place',
            'place_id'   => $place->id,
            'visit_id'   => $visitId,
            'photo_id'   => $photoId,
            'way'        => $way,
            'points'     => $points,
            'detail'     => json_encode($detail),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        if (!$db->affectedRows()) {
            return [0, null];
        }

        return [$points, $detail];
    }

    /**
     * The bonus of a white spot: the person made the place from an OSM candidate in this
     * season, and confirms it by their own photo.
     */
    private function spotBonus(string $userId, object $place, array $season): int
    {
        if (($place->user_id ?? null) !== $userId || empty($place->created_at)) {
            return 0;
        }

        $created = substr((string) $place->created_at, 0, 10);

        if ($created < $season['from'] || $created > $season['to']) {
            return 0;
        }

        $opened = Database::connect()->table('osm_candidates')
            ->where(['place_id' => $place->id, 'linked_by' => $userId, 'status' => 'linked'])
            ->countAllResults();

        return $opened ? $this->config->spotBonus : 0;
    }

    /**
     * A photo was uploaded to a place: when it was shot near the place within a season that
     * still takes confirmations, it counts the place in the season for the uploader. Their
     * visit of that week is confirmed by it; without one the photo makes a quiet visit of its
     * shot day (VisitsModel::HIDDEN_PHOTO) that only carries the score — the person has not
     * said "I was here": the button stays as it was and asks nothing until they tap it.
     *
     * @param object      $place   `id`, `user_id`, `category`, `lat`, `lon`, `created_at`
     * @param object|null $gps     `lat`, `lon` from the EXIF
     * @param string|null $takenAt `Y-m-d H:i:s` from the EXIF
     *
     * @return array|null the confirmation (confirm()), null when the photo proves nothing
     */
    public function photoUploaded(?object $user, object $place, string $photoId, ?object $gps, ?string $takenAt): ?array
    {
        if (!$user || !$gps || !$takenAt) {
            return null;
        }

        $day = substr($takenAt, 0, 10);

        if (!$this->openSeason($day)) {
            return null;
        }

        [$near] = $this->isNear($place, (float) $gps->lat, (float) $gps->lon);

        if (!$near) {
            return null;
        }

        try {
            $result = $this->confirm($user->id, $place, self::WAY_PHOTO, $day, $photoId, VisitsModel::HIDDEN_PHOTO);

            // The photo is the visit's, whenever it was uploaded
            Database::connect()->table('photos')
                ->where(['id' => $photoId, 'visit_id' => null])
                ->update(['visit_id' => $result['visit']->id]);

            (new QuestsLibrary())->placeConfirmed($user->id, $place->id, $result['visit']->id);

            return $result;
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return null;
        }
    }

    /**
     * Before a photo is deleted: the scores of open seasons it proves move to another photo of
     * the person shot at the place in that season; without one a score "I am here" made first
     * goes back to its terms (the photo's bonuses are taken off), and a score only the photo
     * made goes, with the confirmation of its visit.
     * Closed seasons stay as they are.
     */
    public function photoDeleted(string $photoId): void
    {
        $db   = Database::connect();
        $rows = $db->table('game_points gp')
            ->select('gp.id, gp.season, gp.user_id, gp.place_id, gp.visit_id, gp.points, gp.detail, places.lat, places.lon, places.category, s.closed_at')
            ->join('places', 'places.id = gp.place_id')
            ->join('game_seasons s', 's.id = gp.season', 'left')
            ->where('gp.photo_id', $photoId)
            ->get()->getResult();

        foreach ($rows as $row) {
            $season = $this->find($row->season);

            if ($row->closed_at !== null || !$season) {
                continue;
            }

            $other = null;

            foreach ($db->table('photos')
                ->select('id, lat, lon')
                ->where(['user_id' => $row->user_id, 'place_id' => $row->place_id, 'gps' => 1, 'deleted_at' => null])
                ->where('id !=', $photoId)
                ->where('taken_at >=', $season['from'] . ' 00:00:00')
                ->where('taken_at <=', $season['to'] . ' 23:59:59')
                ->get()->getResult() as $photo) {
                if ($this->isNear($row, (float) $photo->lat, (float) $photo->lon)[0]) {
                    $other = $photo->id;
                    break;
                }
            }

            if ($other) {
                $db->table('game_points')->where('id', $row->id)->update(['photo_id' => $other]);
                continue;
            }

            $detail = json_decode((string) $row->detail, true) ?: [];

            // "I am here" proved the place before the photo: the score goes back to its terms
            if (!empty($detail['geo'])) {
                $bonus = (int) ($detail['photo'] ?? 0) + (int) ($detail['spot'] ?? 0);

                $db->table('game_points')->where('id', $row->id)->update([
                    'way'      => self::WAY_GEO,
                    'photo_id' => null,
                    'points'   => max(0, (int) $row->points - $bonus),
                    'detail'   => json_encode(['photo' => 0, 'spot' => 0] + $detail),
                ]);

                if ($row->visit_id) {
                    $db->table('users_visited_places')
                        ->where(['id' => $row->visit_id, 'confirmed' => self::WAY_PHOTO])
                        ->update(['confirmed' => self::WAY_GEO]);
                }

                AchievementsLibrary::forgetProgress($row->user_id);
                continue;
            }

            // No proof left: the score and the confirmation go
            $db->table('game_points')->where('id', $row->id)->delete();

            if ($row->visit_id) {
                $db->table('users_visited_places')
                    ->where(['id' => $row->visit_id, 'confirmed' => self::WAY_PHOTO])
                    ->update(['confirmed' => null, 'confirmed_at' => null]);
            }

            AchievementsLibrary::forgetProgress($row->user_id);
        }
    }

    /**
     * Before a visit is deleted: its scores of open seasons go with it (a closed season keeps
     * its table, the foreign key only clears the link).
     */
    public function visitDeleted(string $visitId): void
    {
        $db = Database::connect();

        $open = array_column(
            $db->table('game_seasons')->select('id')->where('closed_at', null)->get()->getResultArray(),
            'id'
        );

        if ($open) {
            $db->table('game_points')->where('visit_id', $visitId)->whereIn('season', $open)->delete();
        }
    }

    /** A person's points in a season */
    public function total(string $userId, string $seasonId): int
    {
        return (int) (Database::connect()->table('game_points')
            ->selectSum('points', 'total')
            ->where(['season' => $seasonId, 'user_id' => $userId])
            ->get()->getRow()->total ?? 0);
    }

    /**
     * The table of a season: every player with their points, the confirmed places and the
     * walked quests, the best first (more points, then more places, then who got there
     * earlier). `$type` / `$locationId` narrow it to the places of a location (the quests'
     * bonuses are left out there). A closed season without a location reads its frozen table.
     *
     * @return array<int, array{place: int, user_id: string, points: int, places: int, quests: int}>
     */
    public function table(string $seasonId, ?string $type = null, ?int $locationId = null): array
    {
        $db = Database::connect();

        if (!$type) {
            $frozen = $db->table('game_results')
                ->select('place, user_id, points, places, quests')
                ->where('season', $seasonId)
                ->orderBy('place', 'ASC')
                ->get()->getResultArray();

            if ($frozen) {
                return array_map(static fn (array $row) => [
                    'place'   => (int) $row['place'],
                    'user_id' => $row['user_id'],
                    'points'  => (int) $row['points'],
                    'places'  => (int) $row['places'],
                    'quests'  => (int) $row['quests'],
                ], $frozen);
            }
        }

        return $this->liveTable($seasonId, $type, $locationId);
    }

    /**
     * The table counted from the points, whatever is frozen (the tick freezes it from here).
     *
     * @return array<int, array{place: int, user_id: string, points: int, places: int, quests: int}>
     */
    private function liveTable(string $seasonId, ?string $type = null, ?int $locationId = null): array
    {
        $db      = Database::connect();
        $builder = $db->table('game_points gp')
            ->select("gp.user_id, SUM(gp.points) AS points, SUM(gp.kind = 'place') AS places, SUM(gp.kind = 'quest') AS quests, MAX(gp.created_at) AS last", false)
            ->where('gp.season', $seasonId)
            ->groupBy('gp.user_id')
            ->orderBy('points', 'DESC')
            ->orderBy('places', 'DESC')
            ->orderBy('last', 'ASC');

        $column = self::locationColumn($type);

        if ($column && $locationId) {
            $builder
                ->join('places', 'places.id = gp.place_id AND places.deleted_at IS NULL')
                ->where("places.{$column}", $locationId);
        }

        $table = [];

        foreach ($builder->get()->getResultArray() as $index => $row) {
            $table[] = [
                'place'   => $index + 1,
                'user_id' => $row['user_id'],
                'points'  => (int) $row['points'],
                'places'  => (int) $row['places'],
                'quests'  => (int) $row['quests'],
            ];
        }

        return $table;
    }

    /** The `places` column of a location type, null for an unknown type */
    public static function locationColumn(?string $type): ?string
    {
        return ['country' => 'country_id', 'region' => 'region_id', 'district' => 'district_id', 'locality' => 'locality_id'][$type ?? ''] ?? null;
    }

    /**
     * Rows of a table with the players: name, avatar, level.
     *
     * @param array<int, array<string, mixed>> $rows rows of table()
     * @return array<int, array<string, mixed>>
     */
    public function withUsers(array $rows): array
    {
        if (!$rows) {
            return [];
        }

        $users = array_column(
            Database::connect()->table('users')
                ->select('id, name, avatar, level, activity_at')
                ->whereIn('id', array_column($rows, 'user_id'))
                ->get()->getResultArray(),
            null,
            'id'
        );
        $avatars = new AvatarLibrary();
        $result  = [];

        foreach ($rows as $row) {
            $user = $users[$row['user_id']] ?? null;

            if (!$user) {
                continue;
            }

            $result[] = [
                'place'  => $row['place'],
                'points' => $row['points'],
                'places' => $row['places'],
                'quests' => $row['quests'],
                'user'   => [
                    'id'        => $user['id'],
                    'name'      => $user['name'],
                    'avatar'    => $avatars->buildPath($user['id'], $user['avatar'], 'small'),
                    'levelData' => ['level' => (int) $user['level']],
                ],
            ];
        }

        return $result;
    }

    /**
     * The locations of a level the season is played in, the busiest first: for the scope of
     * the rating.
     *
     * @return array<int, array{type: string, id: int, title: string, slug: ?string, players: int, points: int}>
     */
    public function locations(string $seasonId, string $type, string $locale, int $limit = 8): array
    {
        $column = self::locationColumn($type);
        $table  = ['country' => 'location_countries', 'region' => 'location_regions', 'district' => 'location_districts', 'locality' => 'location_localities'][$type] ?? null;

        if (!$column || !$table) {
            return [];
        }

        $rows = Database::connect()->table('game_points gp')
            ->select("places.{$column} AS id, loc.title_ru, loc.title_en, slugs.slug, COUNT(DISTINCT gp.user_id) AS players, SUM(gp.points) AS points", false)
            ->join('places', 'places.id = gp.place_id AND places.deleted_at IS NULL')
            ->join("{$table} loc", "loc.id = places.{$column}")
            ->join('location_slugs slugs', "slugs.type = '{$type}' AND slugs.entity_id = places.{$column} AND slugs.is_primary = 1", 'left')
            ->where('gp.season', $seasonId)
            ->groupBy("places.{$column}, loc.title_ru, loc.title_en, slugs.slug")
            ->orderBy('players', 'DESC')
            ->orderBy('points', 'DESC')
            ->limit($limit)
            ->get()->getResultArray();

        return array_map(static fn (array $row) => [
            'type'    => $type,
            'id'      => (int) $row['id'],
            'title'   => $locale === 'ru' ? ($row['title_ru'] ?: $row['title_en']) : ($row['title_en'] ?: $row['title_ru']),
            'slug'    => $row['slug'],
            'players' => (int) $row['players'],
            'points'  => (int) $row['points'],
        ], $rows);
    }

    /**
     * How much of each location of a level a person has explored. Exploring is being there: the
     * places they have a visit at (a mark or a photo, confirmed or not), of all the published
     * places there. Adding a place to the map is another thing, a discovery, and does not count. The locations they have
     * most in come first. The hidden visits (a riddle quest not walked to the end) count only
     * for the person themselves ($withHidden).
     *
     * @return array<int, array{type: string, id: int, title: string, slug: ?string, explored: int, total: int}>
     */
    public function explored(string $userId, string $type, string $locale, int $limit = 6, bool $withHidden = false): array
    {
        $column = self::locationColumn($type);
        $table  = ['country' => 'location_countries', 'region' => 'location_regions', 'district' => 'location_districts', 'locality' => 'location_localities'][$type] ?? null;

        if (!$column || !$table) {
            return [];
        }

        $rows = Database::connect()->query(
            "SELECT p.{$column} AS id, loc.title_ru, loc.title_en, slugs.slug,
                    COUNT(*) AS total, COUNT(mine.place_id) AS explored
               FROM places p
               JOIN {$table} loc ON loc.id = p.{$column}
               LEFT JOIN location_slugs slugs ON slugs.type = ? AND slugs.entity_id = p.{$column} AND slugs.is_primary = 1
               LEFT JOIN (
                        SELECT DISTINCT place_id FROM users_visited_places WHERE user_id = ? AND hidden <= ?
                    ) mine ON mine.place_id = p.id
              WHERE p.deleted_at IS NULL AND p.{$column} IS NOT NULL
              GROUP BY p.{$column}, loc.title_ru, loc.title_en, slugs.slug
             HAVING explored > 0
              ORDER BY explored DESC, total DESC
              LIMIT " . (int) $limit,
            [$type, $userId, $withHidden ? 1 : 0]
        )->getResultArray();

        return array_map(static fn (array $row) => [
            'type'     => $type,
            'id'       => (int) $row['id'],
            'title'    => $locale === 'ru' ? ($row['title_ru'] ?: $row['title_en']) : ($row['title_en'] ?: $row['title_ru']),
            'slug'     => $row['slug'],
            'explored' => (int) $row['explored'],
            'total'    => (int) $row['total'],
        ], $rows);
    }

    /**
     * A person's share of the whole map: the places they have a visit at, of all the published
     * places of the site. Never reset — the seasons come and go, this only grows.
     *
     * @return array{explored: int, total: int}
     */
    public function exploredWorld(string $userId, bool $withHidden = false): array
    {
        $db = Database::connect();

        $row = $db->query(
            'SELECT COUNT(*) AS total, COUNT(mine.place_id) AS explored
               FROM places p
               LEFT JOIN (
                        SELECT DISTINCT place_id FROM users_visited_places WHERE user_id = ? AND hidden <= ?
                    ) mine ON mine.place_id = p.id
              WHERE p.deleted_at IS NULL',
            [$userId, $withHidden ? 1 : 0]
        )->getRow();

        return ['explored' => (int) ($row->explored ?? 0), 'total' => (int) ($row->total ?? 0)];
    }

    /**
     * The awards that can be earned only within a season: the limited ones (`type` = `seasonal`)
     * whose window lies inside the season's dates. Nothing ties them to the season but the
     * dates — they are ordinary achievements made in the admin page —; the season's page lists
     * them, with the person's own progress.
     *
     * @return array<int, array<string, mixed>>
     */
    public function seasonAwards(array $season, ?string $userId, string $locale): array
    {
        $db   = Database::connect();
        $rows = $db->table('achievements')
            ->where(['type' => 'seasonal', 'is_active' => 1])
            ->where('season_start >=', $season['from'] . ' 00:00:00')
            ->where('season_end <=', $season['to'] . ' 23:59:59')
            ->orderBy('season_start', 'ASC')
            ->orderBy('sort_order', 'ASC')
            ->get()->getResult();

        if (!$rows) {
            return [];
        }

        $earned   = [];
        $progress = [];

        if ($userId) {
            $earned = array_column(
                $db->table('users_achievements')->select('achievement_id, earned_at')
                    ->where('user_id', $userId)->whereIn('achievement_id', array_column($rows, 'id'))
                    ->get()->getResultArray(),
                'earned_at',
                'achievement_id'
            );
            $progress = (new AchievementsLibrary())->getProgress($userId);
        }

        return array_map(static fn ($row) => [
            'id'          => $row->id,
            'title'       => $row->{"title_$locale"} ?: $row->title_ru,
            'description' => $row->{"description_$locale"} ?: $row->description_ru,
            'image'       => $row->image,
            'tier'        => $row->tier,
            'category'    => $row->category,
            'group'       => $row->group_slug,
            'from'        => substr((string) $row->season_start, 0, 10),
            'to'          => substr((string) $row->season_end, 0, 10),
            'experience'  => (int) $row->xp_bonus,
            'earned'      => $earned[$row->id] ?? null,
            'progress'    => $progress[$row->id] ?? null,
        ], $rows);
    }

    /**
     * The seasons a person took part in — has a counted place in —, the latest first, with their
     * points and place there: the season badges of a profile. A closed season reads its frozen
     * table and gives its medal (by the place: gold, silver, bronze, or the grey one), an open
     * one the live table and no medal yet.
     *
     * @return array<int, array{id: string, title: string, image: ?string, closed: bool, points: int, places: int, place: ?int, medal: ?string, medalImage: ?string}>
     */
    public function participations(string $userId, string $locale = 'ru'): array
    {
        $db   = Database::connect();
        $rows = $db->table('game_points gp')
            ->select("gp.season, SUM(gp.points) AS points, SUM(gp.kind = 'place') AS places, r.place", false)
            ->join('game_results r', 'r.season = gp.season AND r.user_id = gp.user_id', 'left')
            ->where('gp.user_id', $userId)
            ->groupBy('gp.season, r.place')
            ->get()->getResultArray();

        $items   = [];
        $seasons = [];

        if ($rows) {
            foreach ($db->table('game_seasons')->whereIn('id', array_column($rows, 'season'))->get()->getResult() as $found) {
                $seasons[$found->id] = self::fromRow($found);
            }
        }

        foreach ($rows as $row) {
            $season = $seasons[$row['season']] ?? null;

            if (!$season) {
                continue;
            }

            $closed = $season['closed_at'] !== null;
            $place  = $row['place'] !== null ? (int) $row['place'] : null;

            // An open season: the place of now
            if ($place === null && !$closed) {
                foreach ($this->table($season['id']) as $line) {
                    if ($line['user_id'] === $userId) {
                        $place = $line['place'];
                        break;
                    }
                }
            }

            // A closed season without a frozen line for the person (its table was frozen before them): no medal
            $medal = $closed && $place !== null ? self::medalOf($place) : null;

            $items[$season['id']] = [
                'id'         => $season['id'],
                'title'      => self::localized($season, 'title', $locale) ?? $season['id'],
                'image'      => $season['image'],
                'closed'     => $closed,
                'points'     => (int) $row['points'],
                'places'     => (int) $row['places'],
                'place'      => $place,
                'medal'      => $medal,
                // A place without its own variant wears the participant's medal
                'medalImage' => $medal ? ($season['medal_' . $medal] ?? $season['image']) : null,
                'from'       => $season['from'],
            ];
        }

        // The latest first
        uasort($items, static fn (array $a, array $b) => strcmp($b['from'], $a['from']));

        return array_values(array_map(static function (array $item) {
            unset($item['from']);

            return $item;
        }, $items));
    }

    /**
     * A text of a season in the visitor's language: English falls back to the Russian one.
     *
     * @param string $field `title` or `description`
     */
    public static function localized(array $season, string $field, string $locale): ?string
    {
        $ru = $season[$field . '_ru'] ?? null;
        $en = $season[$field . '_en'] ?? null;
        $ru = $ru !== null && $ru !== '' ? $ru : null;
        $en = $en !== null && $en !== '' ? $en : null;

        return $locale === 'ru' ? ($ru ?? $en) : ($en ?? $ru);
    }

    /**
     * Closes the seasons whose grace days are over: the table of each is frozen in
     * `game_results`, so a photo or a visit deleted later does not rewrite it. The medals are not
     * stored: they are read from the frozen places. Seasons are never created here.
     *
     * @return string[] the ids of the seasons closed now
     */
    public function tick(): array
    {
        $db    = Database::connect();
        $today = self::today();

        $closed = [];
        $ids    = array_column($db->table('game_seasons')->select('id')->where('closed_at', null)->get()->getResultArray(), 'id');

        foreach ($ids as $id) {
            // The row is held until the table is frozen: a check-in under way finishes first, a
            // later one finds the season closed; a second tick finds it closed and does nothing
            $db->transBegin();

            $row = $db->query('SELECT * FROM game_seasons WHERE id = ? AND closed_at IS NULL FOR UPDATE', [$id])->getRow();

            if (!$row || $today <= $this->lastDay(self::fromRow($row))) {
                $db->transRollback();

                continue;
            }

            try {
                $table = $this->liveTable($id);

                $db->table('game_results')->where('season', $id)->delete();

                if ($table) {
                    $db->table('game_results')->insertBatch(array_map(static fn (array $line) => [
                        'season'  => $id,
                        'user_id' => $line['user_id'],
                        'place'   => $line['place'],
                        'points'  => $line['points'],
                        'places'  => $line['places'],
                        'quests'  => $line['quests'],
                    ], $table));
                }

                $db->table('game_seasons')->where(['id' => $id, 'closed_at' => null])->update([
                    'closed_at' => date('Y-m-d H:i:s'),
                    'players'   => count($table),
                    'places'    => (int) ($db->table('game_points')->select('COUNT(DISTINCT place_id) AS cnt', false)->where(['season' => $id, 'kind' => 'place'])->get()->getRow()->cnt ?? 0),
                ]);

                if (!$db->affectedRows()) {
                    $db->transRollback();

                    continue;
                }

                $db->transCommit();
            } catch (Throwable $e) {
                $db->transRollback();

                throw $e;
            }

            $closed[] = $id;
        }

        return $closed;
    }
}
