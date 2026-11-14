<?php

namespace App\Libraries;

use App\Models\QuestsModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use Config\Database;
use Throwable;

/**
 * Quests of the game (features/26-game-seasons-and-quests.md): a quest is an ordered list of
 * the site's places a person walks, confirming each point ("I am here" on the spot, a photo
 * works too). Not a competition and not on time. Four modes:
 *
 *  - `open`: every point is seen, confirmed in any order;
 *  - `steps`: the length and the first point are seen, confirming a point opens the next one;
 *  - `riddles`: a hint instead of the point; being near the place opens the next riddle;
 *  - `photos`: the riddle is the first photo of the place instead of a text (every place has one).
 *
 * What a person has not opened yet never leaves the server: the API sends the place of a point
 * only once the mode shows it (points()). In the secret modes (riddles, photos —
 * QuestsModel::SECRET_MODES) the visits of the points are hidden until the walk is over (they
 * would give the answers away).
 */
class QuestsLibrary
{
    public const POINTS_MIN = 2;
    public const POINTS_MAX = 30;

    /** Quests a person may have begun and not finished at once: a new one waits for one of them */
    public const ACTIVE_MAX = 10;

    /**
     * Quests as the lists send them, with the person's own walk and the town of the first point.
     * A quest whose first point is seen (not a riddle one) has its cover and `start`, the point on
     * the map; a riddle quest has neither and is on no map of the lists — its search `zone`
     * (zoneOf()) is sent with `$withZone` only, for the quest's own page. With `$from` (the
     * visitor's point) the `distance` in metres: to the start, or to the edge of the zone.
     *
     * @param array<int, object> $quests rows of `quests`
     * @param array{0: float, 1: float}|null $from
     * @return array<int, array<string, mixed>>
     */
    public function listItems(array $quests, string $locale, ?string $userId, ?array $from = null, bool $withZone = false): array
    {
        if (!$quests) {
            return [];
        }

        $db  = Database::connect();
        $ids = array_column($quests, 'id');

        // The first point is seen in the open and the step modes: its cover and town are the quest's
        $first = [];

        foreach ($db->table('quests_points rp')
            ->select('rp.quest_id, rp.place_id')
            ->whereIn('rp.quest_id', $ids)
            ->orderBy('rp.position', 'ASC')
            ->get()->getResult() as $row) {
            $first[$row->quest_id] ??= $row->place_id;
        }

        $places = (new PlaceFormatterLibrary())->listItems(array_values(array_unique($first)), $locale);
        $walks  = $this->walksOf($userId, $ids);
        $items  = [];

        foreach ($quests as $quest) {
            $place = $places[$first[$quest->id] ?? ''] ?? null;
            $item  = $this->format($quest, $locale);

            // The town is the quest's in every mode: a town holds hundreds of places
            if ($place) {
                $item['location'] = $place->address->locality['name'] ?? $place->address->region['name'] ?? null;
            }

            if (QuestsModel::isSecret($quest->mode)) {
                // A riddle quest keeps its places secret: no cover, no start, nothing for a map
                // of the lists — the distance to the edge of its zone; the zone on its own page
                if (!empty($quest->zone_radius)) {
                    if ($withZone) {
                        $item['zone'] = [
                            'lat'    => (float) $quest->zone_lat,
                            'lon'    => (float) $quest->zone_lon,
                            'radius' => (int) $quest->zone_radius,
                        ];
                    }

                    if ($from) {
                        $item['distance'] = max(0, GameLibrary::distance($from[0], $from[1], (float) $quest->zone_lat, (float) $quest->zone_lon) - (int) $quest->zone_radius);
                    }
                }
            } elseif ($place) {
                if (!empty($place->cover)) {
                    $item['cover'] = $place->cover;
                }

                $item['start'] = ['lat' => (float) $place->lat, 'lon' => (float) $place->lon];

                if ($from) {
                    $item['distance'] = GameLibrary::distance($from[0], $from[1], (float) $place->lat, (float) $place->lon);
                }
            }

            $item['walk'] = $walks[$quest->id] ?? null;
            $items[]      = $item;
        }

        return $items;
    }

    /**
     * A quest as the API sends it, without its points.
     *
     * @return array<string, mixed>
     */
    public function format(object $quest, string $locale): array
    {
        $pick = static fn (string $field) => $locale === 'ru'
            ? ($quest->{$field . '_ru'} ?: $quest->{$field . '_en'})
            : ($quest->{$field . '_en'} ?: $quest->{$field . '_ru'});

        return [
            'id'          => $quest->id,
            'title'       => $pick('title'),
            'description' => $pick('description'),
            'mode'        => $quest->mode,
            'status'      => $quest->status,
            'length'      => (int) $quest->length_m,
            'points'      => (int) $quest->points,
            'walked'      => (int) $quest->walked,
            // The experience walking it to the end gives: a quest is no part of a season
            'bonus'       => self::bonusOf((int) $quest->points),
            'updated'     => $quest->updated_at ? new \DateTime((string) $quest->updated_at) : null,
        ];
    }

    /**
     * The person's walks of the quests: when started and finished, how many points confirmed.
     *
     * @param string[] $questIds
     * @return array<string, array{id: string, started: string, finished: ?string, confirmed: int}> by quest id
     */
    public function walksOf(?string $userId, array $questIds): array
    {
        if (!$userId || !$questIds) {
            return [];
        }

        $rows = Database::connect()->table('quests_walks w')
            ->select('w.id, w.quest_id, w.started_at, w.finished_at, COUNT(wp.point_id) AS confirmed', false)
            ->join('quests_walks_points wp', 'wp.walk_id = w.id', 'left')
            ->where('w.user_id', $userId)
            ->whereIn('w.quest_id', $questIds)
            ->groupBy('w.id, w.quest_id, w.started_at, w.finished_at')
            ->get()->getResult();

        $result = [];

        foreach ($rows as $row) {
            $result[$row->quest_id] = [
                'id'        => $row->id,
                'started'   => (string) $row->started_at,
                'finished'  => $row->finished_at ? (string) $row->finished_at : null,
                'confirmed' => (int) $row->confirmed,
            ];
        }

        return $result;
    }

    /**
     * The points of a quest as a person sees them: `done` (confirmed), `current` (the next one
     * of a step or riddle quest), `open` (any point of an open quest) or `locked`. The place of
     * a point is sent only once the mode shows it; the hint — with the place, and with the
     * current riddle. `$full` (the editor) sends everything, with both locales of the hints.
     *
     * @return array<int, array<string, mixed>>
     */
    public function points(object $quest, string $locale, ?string $userId, bool $full = false): array
    {
        $db   = Database::connect();
        // A point whose place was deleted is no point any more
        $rows = $db->table('quests_points rp')
            ->select('rp.*')
            ->join('places', 'places.id = rp.place_id AND places.deleted_at IS NULL')
            ->where('rp.quest_id', $quest->id)
            ->orderBy('rp.position', 'ASC')
            ->get()->getResult();

        if (!$rows) {
            return [];
        }

        $done = [];

        if ($userId) {
            foreach ($db->table('quests_walks_points wp')
                ->select('wp.point_id, wp.created_at')
                ->join('quests_walks w', 'w.id = wp.walk_id')
                ->where(['w.quest_id' => $quest->id, 'w.user_id' => $userId])
                ->get()->getResult() as $row) {
                $done[$row->point_id] = (string) $row->created_at;
            }
        }

        $sequential = $quest->mode !== QuestsModel::MODE_OPEN;
        $current    = null;

        foreach ($rows as $row) {
            if (!isset($done[$row->id])) {
                $current = $row->id;
                break;
            }
        }

        $states  = [];
        $visible = [];

        foreach ($rows as $row) {
            $state = isset($done[$row->id])
                ? 'done'
                : (!$sequential ? 'open' : ($row->id === $current ? 'current' : 'locked'));

            $states[$row->id] = $state;

            // A riddle's place is its answer: shown when found. A step is shown when reached
            $shown = $full
                || $state === 'done'
                || $state === 'open'
                || ($state === 'current' && $quest->mode === QuestsModel::MODE_STEPS);

            if ($shown) {
                $visible[] = $row->place_id;
            }
        }

        // A photo quest's riddle: the first photo of the current point's place, never the place
        $photo = null;

        if (!$full && $quest->mode === QuestsModel::MODE_PHOTOS) {
            foreach ($rows as $row) {
                if ($states[$row->id] === 'current') {
                    $photo = [$row->id, $this->photoOf($row->place_id)];
                    break;
                }
            }
        }

        $places = (new PlaceFormatterLibrary())->listItems(array_values(array_unique($visible)), $locale);

        // What a place is worth now, for the points still to confirm
        $game   = new GameLibrary();
        $season = $game->openSeason(date('Y-m-d'));
        $values = $season ? $game->values(array_values($places), $season, $userId) : [];

        $items = [];

        foreach ($rows as $index => $row) {
            $state = $states[$row->id];
            $item  = [
                'id'       => $row->id,
                'position' => $index + 1,
                'state'    => $state,
            ];

            if (in_array($row->place_id, $visible, true) && isset($places[$row->place_id])) {
                $item['place'] = $places[$row->place_id];

                if ($state !== 'done' && isset($values[$row->place_id]) && $values[$row->place_id]['earned'] === null) {
                    $item['value'] = $values[$row->place_id]['points'];
                }
            }

            if ($photo && $photo[0] === $row->id && $photo[1]) {
                $item['photo'] = $photo[1];
            }

            if ($full) {
                $item['hintRu'] = $row->hint_ru;
                $item['hintEn'] = $row->hint_en;
            } elseif ($quest->mode !== QuestsModel::MODE_PHOTOS && (isset($item['place']) || $state === 'current')) {
                $hint = $locale === 'ru' ? ($row->hint_ru ?: $row->hint_en) : ($row->hint_en ?: $row->hint_ru);

                if ($hint) {
                    $item['hint'] = $hint;
                }
            }

            if ($state === 'done') {
                $item['confirmedAt'] = $done[$row->id];
            }

            $items[] = $item;
        }

        return $items;
    }

    /**
     * Saves the points of a quest in the given order. A place that stays keeps its point (and
     * the walks' confirmations of it), a removed one goes with them. Recounts the length — the
     * sum of the straight lines between the points — and the number of points.
     *
     * @param array<int, array{place: string, hintRu?: ?string, hintEn?: ?string}> $points A hint
     *                                                                                    not sent is kept
     * @param string|null $mode The quest's mode: a photo quest takes only places with a photo
     * @throws \InvalidArgumentException For a missing or repeated place, too few or too many points
     *                                   (`points`, `places`), a place without a photo in a photo quest (`photos`)
     */
    public function savePoints(string $questId, array $points, ?string $mode = null): void
    {
        $db       = Database::connect();
        $placeIds = array_map(static fn ($point) => is_array($point) && is_string($point['place'] ?? null) ? $point['place'] : '', $points);

        if (
            count($placeIds) < self::POINTS_MIN
            || count($placeIds) > self::POINTS_MAX
            || in_array('', $placeIds, true)
            || count(array_unique($placeIds)) !== count($placeIds)
        ) {
            throw new \InvalidArgumentException('points');
        }

        $places = array_column(
            $db->table('places')->select('id, lat, lon')->whereIn('id', $placeIds)->where('deleted_at', null)->get()->getResultArray(),
            null,
            'id'
        );

        if (count($places) !== count($placeIds)) {
            throw new \InvalidArgumentException('places');
        }

        if ($mode === QuestsModel::MODE_PHOTOS && $this->withoutPhoto($placeIds)) {
            throw new \InvalidArgumentException('photos');
        }

        $existing = array_column(
            $db->table('quests_points')->select('id, place_id')->where('quest_id', $questId)->get()->getResultArray(),
            'id',
            'place_id'
        );

        $db->transException(true)->transStart();

        try {
            $gone = array_diff(array_keys($existing), $placeIds);

            if ($gone) {
                $db->table('quests_points')->where('quest_id', $questId)->whereIn('place_id', $gone)->delete();
            }

            $length   = 0;
            $previous = null;

            foreach ($points as $position => $point) {
                $place = $places[$point['place']];
                $data  = ['position' => $position];

                // A hint is saved in the languages sent: the form sends the site's language only,
                // the other one of a point that stays is kept (a bot may send both)
                foreach (['hintRu' => 'hint_ru', 'hintEn' => 'hint_en'] as $key => $column) {
                    if (array_key_exists($key, $point) || !isset($existing[$point['place']])) {
                        $data[$column] = $this->text($point[$key] ?? null);
                    }
                }

                if (isset($existing[$point['place']])) {
                    $db->table('quests_points')->where('id', $existing[$point['place']])->update($data);
                } else {
                    $db->table('quests_points')->insert($data + [
                        'id'       => substr(bin2hex(random_bytes(7)), 0, 13),
                        'quest_id' => $questId,
                        'place_id' => $point['place'],
                    ]);
                }

                if ($previous) {
                    $length += GameLibrary::distance((float) $previous['lat'], (float) $previous['lon'], (float) $place['lat'], (float) $place['lon']);
                }

                $previous = $place;
            }

            $db->table('quests')->where('id', $questId)->update([
                'length_m' => $length,
                'points'   => count($points),
            ] + $this->zoneColumns($questId, array_map(static fn ($id) => $places[$id], $placeIds)));

            $db->transComplete();
        } finally {
            $db->transException(false);
        }
    }

    /**
     * The places of the list that have no photo of their own: a photo quest cannot take them (its
     * riddle is the place's first photo). Kept in the given order.
     *
     * @param array<int, string> $placeIds
     * @return array<int, string>
     */
    public function withoutPhoto(array $placeIds): array
    {
        if (!$placeIds) {
            return [];
        }

        $with = array_column(
            Database::connect()->table('photos')->select('place_id')->whereIn('place_id', $placeIds)
                ->where('deleted_at', null)->groupBy('place_id')->get()->getResultArray(),
            'place_id'
        );

        return array_values(array_diff($placeIds, $with));
    }

    /**
     * The first photo of a place, the earliest uploaded (the first of its gallery), whole — the
     * cover is cut —: the riddle of a photo quest's point; null without one
     *
     * @return array{full: string, preview: string, width: int, height: int}|null
     */
    private function photoOf(string $placeId): ?array
    {
        $row = Database::connect()->table('photos')->select('filename, extension, width, height')
            ->where(['place_id' => $placeId, 'deleted_at' => null])
            ->orderBy('created_at', 'ASC')->orderBy('id', 'ASC')
            ->get(1)->getRow();

        return $row ? [
            'full'    => PATH_PHOTOS . $placeId . '/' . $row->filename . '.' . $row->extension,
            'preview' => PATH_PHOTOS . $placeId . '/' . $row->filename . '_preview.' . $row->extension,
            'width'   => (int) $row->width,
            'height'  => (int) $row->height,
        ] : null;
    }

    /**
     * Counts the search zone of a quest anew from its points (the quests made before the zones).
     */
    public function updateZone(string $questId): void
    {
        $db     = Database::connect();
        $places = $db->table('quests_points rp')
            ->select('places.lat, places.lon')
            ->join('places', 'places.id = rp.place_id')
            ->where('rp.quest_id', $questId)
            ->get()->getResultArray();

        $db->table('quests')->where('id', $questId)->update($this->zoneColumns($questId, $places));
    }

    /**
     * The search zone of a quest: a circle that holds every one of its points, its radius
     * rounded up to 250 m (500 m at least) with room to spare, its centre moved off the middle of
     * the points anywhere within that room, evenly over its area — so the points may lie
     * anywhere in the circle, by its edge as well as near its middle, and the middle of the
     * circle tells nothing. The shift is the quest's own, the same every time: the circle does
     * not wander.
     *
     * @param string                                   $questId the seed of the shift
     * @param array<int, array{lat: mixed, lon: mixed}> $places
     * @return array{lat: float, lon: float, radius: int}|null
     */
    public static function zoneOf(string $questId, array $places): ?array
    {
        if (!$places) {
            return null;
        }

        $lats   = array_map(static fn ($place) => (float) $place['lat'], $places);
        $lons   = array_map(static fn ($place) => (float) $place['lon'], $places);
        $midLat = (min($lats) + max($lats)) / 2;
        $midLon = (min($lons) + max($lons)) / 2;
        $reach  = 0;

        foreach ($places as $index => $place) {
            $reach = max($reach, GameLibrary::distance($midLat, $midLon, $lats[$index], $lons[$index]));
        }

        $radius = (int) max(500, ceil(($reach * 1.3 + 200) / 250) * 250);
        $seed   = crc32($questId);
        $angle  = deg2rad($seed % 360);
        // A point picked evenly over the disc of the room left between the farthest point and
        // the edge (the root of an even number): every point of the quest stays inside, 20 m off it
        $shift  = max(0, $radius - $reach - 20) * sqrt((($seed >> 9) % 1000) / 999);

        return [
            'lat'    => round($midLat + $shift * cos($angle) / 111320, 6),
            'lon'    => round($midLon + $shift * sin($angle) / (111320 * cos(deg2rad($midLat))), 6),
            'radius' => $radius,
        ];
    }

    /**
     * @param array<int, array{lat: mixed, lon: mixed}> $places
     * @return array<string, mixed>
     */
    private function zoneColumns(string $questId, array $places): array
    {
        $zone = self::zoneOf($questId, $places);

        return [
            'zone_lat'    => $zone['lat'] ?? null,
            'zone_lon'    => $zone['lon'] ?? null,
            'zone_radius' => $zone['radius'] ?? null,
        ];
    }

    private function text(mixed $value): ?string
    {
        $value = is_string($value) ? trim(strip_tags($value)) : '';

        return $value === '' ? null : mb_substr($value, 0, 1000);
    }

    /** How many quests a person has walked to the end: the experience counts them (LevelsLibrary) */
    /**
     * The experience of a quest walked to the end: MODIFIER_QUEST_POINT a point, at least
     * MODIFIER_QUEST_MIN. Nothing before the end: the points themselves are visits.
     */
    public static function bonusOf(int $points): int
    {
        return max(MODIFIER_QUEST_MIN, MODIFIER_QUEST_POINT * $points);
    }

    /**
     * The experience of the person's quests walked to the end, each by the points confirmed in
     * its walk (a quest edited later changes nothing of a walk done)
     */
    public function walkedExperience(string $userId): int
    {
        $rows = Database::connect()->table('quests_walks w')
            ->select('COUNT(wp.point_id) AS points', false)
            ->join('quests_walks_points wp', 'wp.walk_id = w.id', 'left')
            ->where('w.user_id', $userId)
            ->where('w.finished_at IS NOT NULL', null, false)
            ->groupBy('w.id')
            ->get()->getResult();

        return array_sum(array_map(static fn ($row) => self::bonusOf((int) $row->points), $rows));
    }

    public function walked(string $userId): int
    {
        return Database::connect()->table('quests_walks')
            ->where('user_id', $userId)
            ->where('finished_at IS NOT NULL', null, false)
            ->countAllResults();
    }

    /**
     * The person's walk of a quest, started when there is none: the one way a walk begins.
     */
    public function start(string $userId, string $questId): object
    {
        $db   = Database::connect();
        $walk = $db->table('quests_walks')->where(['quest_id' => $questId, 'user_id' => $userId])->get()->getRow();

        if ($walk) {
            return $walk;
        }

        if ($this->activeCount($userId) >= self::ACTIVE_MAX) {
            throw new \OverflowException('active');
        }

        try {
            $db->table('quests_walks')->insert([
                'id'         => substr(bin2hex(random_bytes(7)), 0, 13),
                'quest_id'   => $questId,
                'user_id'    => $userId,
                'started_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (DatabaseException) {
            // Two taps at once: the unique key let the first one through
        }

        return $db->table('quests_walks')->where(['quest_id' => $questId, 'user_id' => $userId])->get()->getRow();
    }

    /** How many quests the person has begun and not finished */
    public function activeCount(string $userId): int
    {
        return Database::connect()->table('quests_walks')
            ->where(['user_id' => $userId, 'finished_at' => null])
            ->countAllResults();
    }

    /**
     * The person gives up a walk they began and have not finished: the walk and its marks go
     * (`quests_walks_points` by its foreign key), so the quest is as before it was begun. The
     * visits stay — the person was at those places, and their season points with them; the
     * visits of a riddle quest stay hidden (shown, they would give the answers away to anyone),
     * and are shown when the quest is begun again and walked to the end. A walk never gave
     * experience or an award before its end, so there is nothing else to take back.
     *
     * @return bool false when there is no such walk, or it is walked to the end
     */
    public function leave(string $userId, string $questId): bool
    {
        $db = Database::connect();

        $db->table('quests_walks')
            ->where(['quest_id' => $questId, 'user_id' => $userId, 'finished_at' => null])
            ->delete();

        return $db->affectedRows() > 0;
    }

    /**
     * "I am here" on a quest the person has begun (start()): their position is compared with the point — the given one
     * of an open quest (or the nearest one still to confirm), the current one of a step or
     * riddle quest — and dropped. Near it, the point is confirmed: an ordinary confirmed visit
     * (the season, the feed), and the last point finishes the walk.
     *
     * @param string $day `Y-m-d`, the visitor's day
     *
     * @return array{ok: bool, reason?: string, distance?: int, point?: string, place?: string, finished?: bool, points?: int, bonus?: int, total?: ?int}
     */
    public function confirmHere(object $user, object $quest, ?string $pointId, float $lat, float $lon, ?float $accuracy, string $day): array
    {
        $db   = Database::connect();
        $game = new GameLibrary();
        // A walk is begun on the quest's page, by the walker: never by being near one of its points
        $walk = $db->table('quests_walks')->where(['quest_id' => $quest->id, 'user_id' => $user->id])->get()->getRow();

        if (!$walk) {
            return ['ok' => false, 'reason' => 'not_started'];
        }

        if ($walk->finished_at) {
            return ['ok' => false, 'reason' => 'finished'];
        }

        $rows = $db->table('quests_points rp')
            ->select('rp.id, rp.place_id, places.user_id, places.category, places.lat, places.lon, places.created_at, wp.point_id AS done')
            ->join('places', 'places.id = rp.place_id AND places.deleted_at IS NULL')
            ->join('quests_walks_points wp', 'wp.point_id = rp.id AND wp.walk_id = ' . $db->escape($walk->id), 'left')
            ->where('rp.quest_id', $quest->id)
            ->orderBy('rp.position', 'ASC')
            ->get()->getResult();

        $left = array_values(array_filter($rows, static fn ($row) => $row->done === null));

        if (!$left) {
            // The points left were removed from the quest (or their places deleted): the walk is over
            $this->finishIfDone($walk, $quest, $day);

            return ['ok' => false, 'reason' => 'finished'];
        }

        if ($quest->mode === QuestsModel::MODE_OPEN) {
            $candidates = $pointId ? array_values(array_filter($left, static fn ($row) => $row->id === $pointId)) : $left;
        } else {
            $candidates = [$left[0]];
        }

        $target  = null;
        $reached = null;
        $closest = null;

        // The nearest of the points the person is within the radius of (the radius is the category's)
        foreach ($candidates as $row) {
            [$near, $distance] = $game->isNear($row, $lat, $lon, $accuracy);

            $closest = $closest === null ? $distance : min($closest, $distance);

            if ($near && ($reached === null || $distance < $reached)) {
                $reached = $distance;
                $target  = $row;
            }
        }

        if (!$target) {
            // How far a riddle's answer is would be a hint of its own
            return QuestsModel::isSecret($quest->mode)
                ? ['ok' => false, 'reason' => 'far']
                : ['ok' => false, 'reason' => 'far', 'distance' => $closest];
        }

        $place = (object) [
            'id'         => $target->place_id,
            'user_id'    => $target->user_id,
            'category'   => $target->category,
            'created_at' => $target->created_at,
        ];

        $result   = $game->confirm($user->id, $place, GameLibrary::WAY_GEO, $day, null, QuestsModel::isSecret($quest->mode));
        $finished = $this->markPoint($walk, $quest, $target->id, $result['visit']->id, $day);

        return [
            'ok'       => true,
            'point'    => $target->id,
            'place'    => $target->place_id,
            'finished' => $finished['finished'],
            'points'   => $result['points'],
            'bonus'    => $finished['bonus'],
            'total'    => $result['season'] ? $game->total($user->id, $result['season']['id']) : null,
        ];
    }

    /**
     * A place was confirmed outside a quest (a photo, "I am here" on its page): the person's
     * unfinished walks with that place as a point they may confirm now take it.
     */
    public function placeConfirmed(string $userId, string $placeId, string $visitId): void
    {
        try {
            $db    = Database::connect();
            $walks = $db->table('quests_walks w')
                ->select('w.id, w.quest_id, w.finished_at, quests.mode, rp.id AS point_id')
                ->join('quests', 'quests.id = w.quest_id AND quests.deleted_at IS NULL')
                ->join('quests_points rp', 'rp.quest_id = w.quest_id')
                ->where(['w.user_id' => $userId, 'w.finished_at' => null, 'rp.place_id' => $placeId])
                ->get()->getResult();

            foreach ($walks as $walk) {
                if ($walk->mode !== QuestsModel::MODE_OPEN) {
                    $current = $db->table('quests_points rp')
                        ->select('rp.id')
                        ->join('places', 'places.id = rp.place_id AND places.deleted_at IS NULL')
                        ->join('quests_walks_points wp', 'wp.point_id = rp.id AND wp.walk_id = ' . $db->escape($walk->id), 'left')
                        ->where('rp.quest_id', $walk->quest_id)
                        ->where('wp.point_id', null)
                        ->orderBy('rp.position', 'ASC')
                        ->get()->getRow();

                    if (!$current || $current->id !== $walk->point_id) {
                        continue;
                    }
                }

                $this->markPoint($walk, (object) ['id' => $walk->quest_id, 'mode' => $walk->mode], $walk->point_id, $visitId, date('Y-m-d'));
            }
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }
    }

    /**
     * Marks a point of a walk confirmed; the last one finishes the walk (finishIfDone()).
     *
     * @return array{finished: bool, bonus: int}
     */
    private function markPoint(object $walk, object $quest, string $pointId, string $visitId, string $day): array
    {
        $db = Database::connect();

        try {
            $db->table('quests_walks_points')->insert([
                'walk_id'    => $walk->id,
                'point_id'   => $pointId,
                'visit_id'   => $visitId,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (DatabaseException) {
            // Confirmed already
        }

        return $this->finishIfDone($walk, $quest, $day);
    }

    /**
     * Finishes a walk once every point the quest still has is confirmed (a point whose place
     * was deleted is none): the experience of a walked quest, the hidden visits of a riddle
     * quest shown, the awards checked. Once per walk. Nothing of it goes to a season: a quest is
     * walked once and for good, whatever the season.
     *
     * @return array{finished: bool, bonus: int}
     */
    private function finishIfDone(object $walk, object $quest, string $day): array
    {
        $db = Database::connect();

        $left = $db->table('quests_points rp')
            ->join('places', 'places.id = rp.place_id AND places.deleted_at IS NULL')
            ->join('quests_walks_points wp', 'wp.point_id = rp.id AND wp.walk_id = ' . $db->escape($walk->id), 'left')
            ->where('rp.quest_id', $quest->id)
            ->where('wp.point_id', null)
            ->countAllResults();

        if ($left > 0) {
            return ['finished' => false, 'bonus' => 0];
        }

        // Only one request finishes the walk
        $db->table('quests_walks')
            ->where(['id' => $walk->id, 'finished_at' => null])
            ->update(['finished_at' => date('Y-m-d H:i:s')]);

        if (!$db->affectedRows()) {
            return ['finished' => true, 'bonus' => 0];
        }

        $userId = $db->table('quests_walks')->select('user_id')->where('id', $walk->id)->get()->getRow()->user_id;

        $db->table('quests')->where('id', $quest->id)->set('walked', 'walked + 1', false)->update();

        try {
            // A walked quest is experience, counted from the walks: the level is recounted
            $walker = (new \App\Models\UsersModel())->select('id, experience, level')->find($userId);

            if ($walker) {
                (new LevelsLibrary())->calculate($walker);
            }

            // The visits of a riddle quest were its answers: the walk is over, they are shown
            (new VisitsLibrary())->reveal(array_filter(array_column(
                $db->table('quests_walks_points')->select('visit_id')->where('walk_id', $walk->id)->get()->getResultArray(),
                'visit_id'
            )));

            (new AchievementsLibrary())->check($userId, 'game');
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
        }

        $confirmed = $db->table('quests_walks_points')->where('walk_id', $walk->id)->countAllResults();

        return ['finished' => true, 'bonus' => self::bonusOf($confirmed)];
    }
}
