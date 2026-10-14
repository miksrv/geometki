<?php

namespace App\Controllers;

use App\Libraries\FeedPulseLibrary;
use App\Libraries\FeedPresenter;
use App\Models\FeedModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;

/**
 * The activity feed: stories of what people do on the site (App\Models\FeedModel,
 * written by App\Libraries\FeedLibrary), the site's pulse and a user's contribution
 * calendar.
 *
 * @package App\Controllers
 */
class Feed extends ResourceController
{
    private const LIMIT_DEFAULT = 20;
    private const LIMIT_MAX     = 40;

    /** Story types the `types` filter accepts */
    private const TYPES = [
        'place', 'photo', 'photo_link', 'edit', 'comment', 'rating', 'visit',
        'collection', 'collection_place', 'achievement', 'level',
    ];

    /** The pulse covers a week, or a month when the week has fewer events than this */
    private const PULSE_MIN_EVENTS = 10;

    /** Most active people shown in the pulse */
    private const PULSE_USERS = 8;

    /** Days in the contribution calendar */
    private const CALENDAR_DAYS = 365;

    /** Seconds the pulse is cached: it is on every home page view */
    private const PULSE_CACHE_TTL = 60;

    /**
     * GET /feed — a page of stories, newest-updated first.
     *
     * Query: author, place (a place's history: only its events), types (comma-separated
     * story types), weight (minimum story weight, 2 for the home page), limit, cursor
     * (`next` of the previous page), countOnly=true (only `count`).
     * `count` — the number of stories — comes with an author or place filter on the
     * first page.
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $author = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS) ?: null;
        $place  = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS) ?: null;
        $types  = array_values(array_intersect(
            explode(',', (string) $this->request->getGet('types', FILTER_SANITIZE_SPECIAL_CHARS)),
            self::TYPES
        ));
        $weight = (int) $this->request->getGet('weight', FILTER_SANITIZE_NUMBER_INT);
        $limit  = (int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?: self::LIMIT_DEFAULT);
        $limit  = max(1, min(abs($limit), self::LIMIT_MAX));
        $cursor = $this->request->getGet('cursor');
        $cursor = is_string($cursor) ? self::parseCursor($cursor) : null;

        $filters = [
            'author'    => $author,
            'place'     => $place,
            'types'     => $types,
            'minWeight' => $weight,
        ];

        $model = new FeedModel();
        $count = ($author || $place) && !$cursor ? $model->countStories($filters) : null;

        if ($this->request->getGet('countOnly') === 'true') {
            return $this->respond(['items' => [], 'next' => null, 'count' => (int) $count]);
        }

        $rows    = $model->getStories($filters, $limit + 1, $cursor);
        $hasMore = count($rows) > $limit;

        if ($hasMore) {
            array_pop($rows);
        }

        $last     = end($rows);
        $response = [
            'items' => (new FeedPresenter($this->request->getLocale()))->present($rows, $place),
            'next'  => $hasMore && $last ? self::makeCursor($last->updated_at, $last->id) : null,
        ];

        if ($count !== null) {
            $response['count'] = $count;
        }

        return $this->respond($response);
    }

    /**
     * GET /feed/pulse — what happened on the site lately: event counts for the last
     * week (or month, when the week was quiet), the number of people who did something,
     * the most active of them and the time of the latest event.
     *
     * @return ResponseInterface
     */
    public function pulse(): ResponseInterface
    {
        $cached = cache('feed_pulse');

        if (is_array($cached)) {
            return $this->respond($cached);
        }

        $db      = Database::connect();
        $library = new FeedPulseLibrary();

        foreach ([7, 30] as $days) {
            $since  = date('Y-m-d H:i:s', strtotime("-$days days"));
            $counts = $library->counts($since);

            if ($counts['total'] >= self::PULSE_MIN_EVENTS) {
                break;
            }
        }

        $counts += $library->people($since, null, self::PULSE_USERS);

        // ORDER BY + LIMIT walks the created_at index back to the first match; MAX() with
        // these conditions scans the whole table
        $latest = $db->table('activity')
            ->select('created_at')
            ->where('deleted_at', null)
            ->where('type !=', 'bookmark')
            ->orderBy('created_at', 'DESC')
            ->limit(1)
            ->get()
            ->getRow();

        $pulse = [
            'period'      => $days,
            'places'      => $counts['places'],
            'photos'      => $counts['photos'],
            'comments'    => $counts['comments'],
            'ratings'     => $counts['ratings'],
            'edits'       => $counts['edits'],
            'visits'      => $counts['visits'],
            'collections' => $counts['collections'],
            'authors'     => $counts['authors'],
            'users'       => array_map(static fn (array $user) => [
                'id'     => $user['id'],
                'name'   => $user['name'],
                'avatar' => $user['avatar'],
            ], $counts['users']),
            'updated'     => !empty($latest?->created_at) ? new \DateTime($latest->created_at) : null,
        ];

        cache()->save('feed_pulse', $pulse, self::PULSE_CACHE_TTL);

        return $this->respond($pulse);
    }

    /**
     * GET /feed/calendar?author=ID&tz=ZONE — a user's events per day over the last year,
     * for the contribution calendar of the profile. Days without events are not listed.
     * Days are days of the viewer's time zone `tz` (an IANA name; the site's time zone,
     * SITE_TIMEZONE, when it is missing or unknown), `from` and `to` too. The zone's
     * offset of today is used for the whole year.
     *
     * @return ResponseInterface
     */
    public function calendar(): ResponseInterface
    {
        $author = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS);

        if (!$author) {
            return $this->failValidationErrors('author is required');
        }

        $zone   = self::timeZone($this->request->getGet('tz'));
        $today  = new \DateTimeImmutable('today', $zone);
        $first  = $today->modify('-' . (self::CALENDAR_DAYS - 1) . ' days');
        $offset = $zone->getOffset($today);

        $rows = Database::connect()->table('activity')
            ->select('DATE(created_at + INTERVAL ' . $offset . ' SECOND) as day, COUNT(*) as cnt', false)
            ->where('user_id', $author)
            ->where('created_at >=', $first->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s'))
            ->where('deleted_at', null)
            ->where('type !=', 'bookmark')
            ->groupBy('day')
            ->orderBy('day', 'ASC')
            ->get()
            ->getResult();

        $items = array_map(static fn (object $row) => [
            'date'  => $row->day,
            'count' => (int) $row->cnt,
        ], $rows);

        return $this->respond([
            'items' => $items,
            'total' => array_sum(array_column($items, 'count')),
            'from'  => $first->format('Y-m-d'),
            'to'    => $today->format('Y-m-d'),
        ]);
    }

    /**
     * The viewer's time zone by its IANA name (old names such as Europe/Kiev, which
     * browsers still report, too), else the site's one.
     */
    public static function timeZone(mixed $name): \DateTimeZone
    {
        if (is_string($name) && in_array($name, \DateTimeZone::listIdentifiers(\DateTimeZone::ALL_WITH_BC), true)) {
            return new \DateTimeZone($name);
        }

        return new \DateTimeZone(SITE_TIMEZONE);
    }

    /**
     * The keyset cursor of the story after which the next page starts: "<unix time>-<id>".
     */
    public static function makeCursor(string $updatedAt, string $id): string
    {
        return strtotime($updatedAt) . '-' . $id;
    }

    /**
     * @return array{at: string, id: string}|null
     */
    public static function parseCursor(string $cursor): ?array
    {
        if (!preg_match('/^(\d{1,11})-([a-z0-9]{1,15})$/', $cursor, $match)) {
            return null;
        }

        return ['at' => date('Y-m-d H:i:s', (int) $match[1]), 'id' => $match[2]];
    }
}
