<?php

namespace App\Models;

use CodeIgniter\Database\BaseBuilder;

/**
 * Model for the `feed` table: the stories of the activity feed, each a group of
 * activity rows (`activity.feed_id`) or, for achievements and levels, a row of its own.
 * Stories are written by App\Libraries\FeedLibrary and read newest-updated first.
 *
 * A story is shown only while something in it is: its place and collection exist (a
 * hidden collection is private), its author's account exists, and — unless it is an
 * achievement or a level — at least one of its activity rows is not deleted.
 *
 * @package App\Models
 */
class FeedModel extends ApplicationBaseModel
{
    protected $table            = 'feed';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'object';
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'id',
        'type',
        'user_id',
        'place_id',
        'collection_id',
        'achievement_id',
        'level',
        'weight',
        'created_at',
        'updated_at',
    ];

    // Story times are the times of its events, set by FeedLibrary, not of the writes
    protected $useTimestamps = false;

    protected $skipValidation = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    /** Story types without activity rows */
    public const OWN_ROW_TYPES = ['achievement', 'level'];

    /**
     * A page of visible stories, newest-updated first.
     *
     * @param array{author?: ?string, place?: ?string, types?: string[], minWeight?: int, since?: string, until?: string} $filters
     * @param int                                        $limit
     * @param array{at: string, id: string}|null         $cursor Stories after this one (keyset)
     * @return array<int, object>
     */
    public function getStories(array $filters, int $limit, ?array $cursor = null): array
    {
        $builder = $this->visibleStories($filters)->select('feed.*');

        if ($cursor) {
            $builder->groupStart()
                ->where('feed.updated_at <', $cursor['at'])
                ->orGroupStart()
                    ->where('feed.updated_at', $cursor['at'])
                    ->where('feed.id <', $cursor['id'])
                ->groupEnd()
            ->groupEnd();
        }

        return $builder
            ->orderBy('feed.updated_at', 'DESC')
            ->orderBy('feed.id', 'DESC')
            ->limit($limit)
            ->get()
            ->getResult();
    }

    /**
     * Number of visible stories for the filters (the "History (N)" row of the place page).
     *
     * @param array{author?: ?string, place?: ?string, types?: string[], minWeight?: int, since?: string, until?: string} $filters
     */
    public function countStories(array $filters): int
    {
        return (int) $this->visibleStories($filters)->countAllResults();
    }

    /** Events of a story loaded to show it: its photos and places are cut to fewer anyway */
    public const EVENTS_PER_STORY = 40;

    /**
     * The latest EVENTS_PER_STORY activity rows of each of the given stories with what
     * they point at, oldest first. A story of hundreds of events (an import) costs no more
     * than that; getStoryCounts() gives the totals. With $placeId only the rows about that
     * place (a rating story spans many places). Rows whose photo or comment is gone come
     * back with empty columns; the caller skips them. A linked photo (`photo_link`) comes
     * with its details as the `ep_*` columns; unlinking deletes its row.
     *
     * @param string[]    $feedIds
     * @param string|null $placeId
     * @return array<int, object>
     */
    public function getStoryEvents(array $feedIds, ?string $placeId = null): array
    {
        if (empty($feedIds)) {
            return [];
        }

        $ids   = implode(', ', array_map([$this->db, 'escape'], $feedIds));
        $place = $placeId ? ' AND a.place_id = ' . $this->db->escape($placeId) : '';

        return $this->db->query(
            "SELECT e.*
               FROM (
                    SELECT a.id, a.feed_id, a.type, a.place_id, a.collection_id, a.created_at,
                           ph.id AS photo_id, ph.filename, ph.extension, ph.width, ph.height,
                           ep.id AS ep_id, ep.source AS ep_source, ep.external_id AS ep_external_id,
                           ep.title AS ep_title, ep.author AS ep_author, ep.license AS ep_license,
                           ep.license_url AS ep_license_url, ep.year AS ep_year, ep.page_url AS ep_page_url,
                           ep.full_url AS ep_full_url, ep.preview_url AS ep_preview_url,
                           ep.width AS ep_width, ep.height AS ep_height, ep.created_at AS ep_created_at,
                           r.value AS rating,
                           cm.id AS comment_id, cm.content AS comment,
                           ROW_NUMBER() OVER (PARTITION BY a.feed_id ORDER BY a.created_at DESC, a.id DESC) AS n
                      FROM activity a
                      LEFT JOIN photos ph ON ph.id = a.photo_id AND ph.deleted_at IS NULL
                      LEFT JOIN places_external_photos ep ON ep.id = a.external_photo_id
                      LEFT JOIN rating r ON r.id = a.rating_id AND r.deleted_at IS NULL
                      LEFT JOIN comments cm ON cm.id = a.comment_id AND cm.deleted_at IS NULL
                     WHERE a.feed_id IN ($ids) AND a.deleted_at IS NULL$place
               ) e
              WHERE e.n <= " . self::EVENTS_PER_STORY . '
              ORDER BY e.created_at ASC, e.id ASC'
        )->getResult();
    }

    /**
     * Totals of the given stories, whatever getStoryEvents() cut: events, photos still
     * there (uploaded and linked), distinct places. With $placeId only the events about that place.
     *
     * @param string[]    $feedIds
     * @param string|null $placeId
     * @return array<string, object> {events, photos, places} by story ID
     */
    public function getStoryCounts(array $feedIds, ?string $placeId = null): array
    {
        if (empty($feedIds)) {
            return [];
        }

        $builder = $this->db->table('activity a')
            ->select('a.feed_id, COUNT(*) AS events, COUNT(ph.id) + COUNT(ep.id) AS photos, COUNT(DISTINCT a.place_id) AS places')
            ->join('photos ph', 'ph.id = a.photo_id AND ph.deleted_at IS NULL', 'left')
            ->join('places_external_photos ep', 'ep.id = a.external_photo_id', 'left')
            ->whereIn('a.feed_id', $feedIds)
            ->where('a.deleted_at', null)
            ->groupBy('a.feed_id');

        if ($placeId) {
            $builder->where('a.place_id', $placeId);
        }

        $counts = [];

        foreach ($builder->get()->getResult() as $row) {
            $counts[$row->feed_id] = (object) [
                'events' => (int) $row->events,
                'photos' => (int) $row->photos,
                'places' => (int) $row->places,
            ];
        }

        return $counts;
    }

    /**
     * The author's stories of the given types started since $since: the ones a new event
     * may join (App\Libraries\FeedAggregator::match()). Guests (null) share stories.
     * $subject narrows them to the event's place or collection
     * (App\Libraries\FeedAggregator::subject()), so a busy author's other stories never
     * crowd the right one out of the limit.
     *
     * @param string|null                $userId
     * @param string[]                   $types
     * @param string                     $since   Y-m-d H:i:s
     * @param array<string, string|null> $subject [place_id|collection_id => value], or []
     * @return array<int, object> {id, type, user_id, place_id, collection_id, created_at: int}
     */
    public function getOpenStories(?string $userId, array $types, string $since, array $subject = []): array
    {
        if (empty($types)) {
            return [];
        }

        $builder = $this->db->table('feed')
            ->select('id, type, user_id, place_id, collection_id, created_at')
            ->where('user_id', $userId)
            ->whereIn('type', $types)
            ->where('created_at >=', $since);

        foreach ($subject as $column => $value) {
            $builder->where($column, $value);
        }

        $rows = $builder
            ->orderBy('created_at', 'DESC')
            ->limit(50)
            ->get()
            ->getResult();

        foreach ($rows as $row) {
            $row->created_at = strtotime($row->created_at);
        }

        return $rows;
    }

    /**
     * An event joined a story: move its last-event time forward and set its type and
     * weight (an event may promote the story, App\Libraries\FeedAggregator::joinedType()).
     *
     * @param array{type: string, weight: int} $joined
     */
    public function touchStory(string $id, string $at, array $joined): void
    {
        $this->db->table('feed')
            ->set('updated_at', 'GREATEST(updated_at, ' . $this->db->escape($at) . ')', false)
            ->set('type', $joined['type'])
            ->set('weight', $joined['weight'])
            ->where('id', $id)
            ->update();
    }

    /**
     * The visibility rules and the filters, shared by the page and the count.
     *
     * @param array{author?: ?string, place?: ?string, types?: string[], minWeight?: int, since?: string, until?: string} $filters
     */
    protected function visibleStories(array $filters): BaseBuilder
    {
        $builder = $this->db->table('feed')
            ->join('users fu', 'fu.id = feed.user_id', 'left')
            ->join('places fp', 'fp.id = feed.place_id', 'left')
            ->join('collections fc', 'fc.id = feed.collection_id', 'left')
            ->where('(feed.user_id IS NULL OR fu.deleted_at IS NULL)', null, false)
            ->where('(feed.place_id IS NULL OR fp.deleted_at IS NULL)', null, false)
            ->where('(feed.collection_id IS NULL OR (fc.deleted_at IS NULL AND fc.hidden = 0))', null, false);

        $place = $filters['place'] ?? null;

        if ($place) {
            // A place's history: the stories with an event about it (achievements have none).
            // EXISTS is a semi-join here: the few events of the place first, then their stories.
            $builder->where(
                'EXISTS (SELECT 1 FROM activity a WHERE a.feed_id = feed.id AND a.deleted_at IS NULL AND a.place_id = '
                . $this->db->escape($place) . ')',
                null,
                false
            );
        } else {
            // A dependent subquery on purpose: the stories are read in index order and each
            // is checked by activity.feed_id until the page is full. EXISTS lets MariaDB
            // materialize the subquery, a scan of the whole log on every request.
            $builder->where(
                "(feed.type IN ('" . implode("', '", self::OWN_ROW_TYPES) . "')"
                . ' OR (SELECT a.id FROM activity a WHERE a.feed_id = feed.id AND a.deleted_at IS NULL LIMIT 1) IS NOT NULL)',
                null,
                false
            );
        }

        if (!empty($filters['author'])) {
            $builder->where('feed.user_id', $filters['author']);
        }

        if (!empty($filters['types'])) {
            $builder->whereIn('feed.type', $filters['types']);
        }

        if (!empty($filters['minWeight'])) {
            $builder->where('feed.weight >=', (int) $filters['minWeight']);
        }

        // Stories that grew in a period (the weekly digest)
        if (!empty($filters['since'])) {
            $builder->where('feed.updated_at >=', $filters['since']);
        }

        if (!empty($filters['until'])) {
            $builder->where('feed.updated_at <=', $filters['until']);
        }

        return $builder;
    }
}
