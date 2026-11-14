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
 * A confirmed place gives season points once a season for a person (`game_points`); the season
 * is the one of the visit day, by the calendar: the warm one (April — September) or the cold one
 * (October — March): two a year, long enough for a small community to fill a table. A season takes confirmations until Config\Game::$graceDays after its end, then
 * `php spark game:tick` closes it: the table is frozen in `game_results`.
 *
 * Closed (Config\Game::$open is false), the game exists only for the administrators.
 */
class GameLibrary
{
    public const WAY_PHOTO = 'photo';
    public const WAY_GEO   = 'geo';

    /** The first month of each season of the year */
    private const SEASON_START = ['warm' => 4, 'cold' => 10];

    /** The months of a season */
    private const SEASON_MONTHS = 6;

    private Game $config;

    public function __construct()
    {
        $this->config = config(Game::class);
    }

    /**
     * The season of a day, by the calendar. A cold season is named by the year it starts in:
     * January 2027 is in `2026-cold`.
     *
     * @param string $day `Y-m-d`
     * @return array{id: string, key: string, year: int, from: string, to: string}
     */
    public static function seasonOf(string $day): array
    {
        $year  = (int) substr($day, 0, 4);
        $month = (int) substr($day, 5, 2);

        if ($month >= 4 && $month <= 9) {
            return self::season('warm', $year);
        }

        return self::season('cold', $month <= 3 ? $year - 1 : $year);
    }

    /**
     * A season by its id (`2026-cold`), null for anything else.
     *
     * @return array{id: string, key: string, year: int, from: string, to: string}|null
     */
    public static function seasonById(string $id): ?array
    {
        if (!preg_match('/^(\d{4})-(warm|cold)$/', $id, $match)) {
            return null;
        }

        return self::season($match[2], (int) $match[1]);
    }

    /**
     * @return array{id: string, key: string, year: int, from: string, to: string}
     */
    private static function season(string $key, int $year): array
    {
        $month = self::SEASON_START[$key];
        $from  = sprintf('%04d-%02d-01', $year, $month);

        return [
            'id'   => $year . '-' . $key,
            'key'  => $key,
            'year' => $year,
            'from' => $from,
            // The last day of the sixth month
            'to'   => date('Y-m-d', strtotime($from . ' +' . self::SEASON_MONTHS . ' months -1 day')),
        ];
    }

    /** The last day a season takes confirmations: its photos are uploaded at home */
    public function lastDay(array $season): string
    {
        return date('Y-m-d', strtotime($season['to'] . ' +' . $this->config->graceDays . ' days'));
    }

    /**
     * The season a confirmation of that day counts in: the season of the day, while it is not
     * closed and still takes confirmations. Makes sure the season exists.
     *
     * @return array{id: string, key: string, year: int, from: string, to: string}|null
     */
    public function openSeason(string $day): ?array
    {
        $season = self::seasonOf($day);
        $today  = date('Y-m-d');

        // A day ahead of the server's is the visitor's time zone; further is not a visit
        if ($day > date('Y-m-d', strtotime('+1 day')) || $today > $this->lastDay($season)) {
            return null;
        }

        $row = $this->ensureSeason($season);

        return $row && $row->closed_at === null ? $season : null;
    }

    /**
     * The row of a season, created when the season is met for the first time: nothing of a
     * season is made by hand but its picture (`game_seasons.image`). A season has no award and
     * no tasks: it is the confirmed places of its months, and who has more points.
     */
    public function ensureSeason(array $season): ?object
    {
        $db  = Database::connect();
        $row = $db->table('game_seasons')->where('id', $season['id'])->get()->getRow();

        if ($row) {
            return $row;
        }

        try {
            $db->table('game_seasons')->insert([
                'id'         => $season['id'],
                'starts_on'  => $season['from'],
                'ends_on'    => $season['to'],
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (DatabaseException) {
            // Two requests at the start of a season: the other one made it
        }

        return $db->table('game_seasons')->where('id', $season['id'])->get()->getRow();
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
            [$added, $detail] = $this->score($userId, $place, $season, $way, $visit->id, $photoId);
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
    private function score(string $userId, object $place, array $season, string $way, string $visitId, ?string $photoId): array
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

        try {
            $db->table('game_points')->insert([
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
        } catch (DatabaseException) {
            // Two confirmations at once: the unique key let the first one through
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
            $season = self::seasonById($row->season);

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
     * table, an open one the live one.
     *
     * @return array<int, array{id: string, key: string, year: int, image: ?string, closed: bool, points: int, places: int, place: ?int}>
     */
    public function participations(string $userId): array
    {
        $db   = Database::connect();
        $rows = $db->table('game_points gp')
            ->select("gp.season, SUM(gp.points) AS points, SUM(gp.kind = 'place') AS places, s.image, s.closed_at, s.starts_on, r.place", false)
            ->join('game_seasons s', 's.id = gp.season', 'left')
            ->join('game_results r', 'r.season = gp.season AND r.user_id = gp.user_id', 'left')
            ->where('gp.user_id', $userId)
            ->groupBy('gp.season, s.image, s.closed_at, s.starts_on, r.place')
            ->orderBy('s.starts_on', 'DESC')
            ->get()->getResultArray();

        $items = [];

        foreach ($rows as $row) {
            $season = self::seasonById($row['season']);

            if (!$season) {
                continue;
            }

            $place = $row['place'] !== null ? (int) $row['place'] : null;

            // An open season: the place of now
            if ($place === null && $row['closed_at'] === null) {
                foreach ($this->table($season['id']) as $line) {
                    if ($line['user_id'] === $userId) {
                        $place = $line['place'];
                        break;
                    }
                }
            }

            $items[] = [
                'id'     => $season['id'],
                'key'    => $season['key'],
                'year'   => $season['year'],
                'image'  => $row['image'],
                'closed' => $row['closed_at'] !== null,
                'points' => (int) $row['points'],
                'places' => (int) $row['places'],
                'place'  => $place,
            ];
        }

        return $items;
    }

    /**
     * Closes the seasons whose grace days are over: the table of each is frozen in
     * `game_results`, so a photo or a visit deleted later does not rewrite it. Also makes sure
     * the current season exists.
     *
     * @return string[] the ids of the seasons closed now
     */
    public function tick(): array
    {
        $db    = Database::connect();
        $today = date('Y-m-d');

        $this->ensureSeason(self::seasonOf($today));

        $closed = [];
        $rows   = $db->table('game_seasons')->where('closed_at', null)->get()->getResult();

        foreach ($rows as $row) {
            $season = self::seasonById($row->id);

            if (!$season || $today <= $this->lastDay($season)) {
                continue;
            }

            $table = $this->table($row->id);

            $db->transStart();
            $db->table('game_results')->where('season', $row->id)->delete();

            if ($table) {
                $db->table('game_results')->insertBatch(array_map(static fn (array $line) => [
                    'season'  => $row->id,
                    'user_id' => $line['user_id'],
                    'place'   => $line['place'],
                    'points'  => $line['points'],
                    'places'  => $line['places'],
                    'quests'  => $line['quests'],
                ], $table));
            }

            $db->table('game_seasons')->where('id', $row->id)->update([
                'closed_at' => date('Y-m-d H:i:s'),
                'players'   => count($table),
                'places'    => $db->table('game_points')->select('COUNT(DISTINCT place_id) AS cnt', false)->where(['season' => $row->id, 'kind' => 'place'])->get()->getRow()->cnt ?? 0,
            ]);
            $db->transComplete();

            $closed[] = $row->id;
        }

        return $closed;
    }
}
