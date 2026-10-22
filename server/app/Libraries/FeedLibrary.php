<?php

namespace App\Libraries;

use App\Models\FeedModel;
use CodeIgniter\Database\BaseConnection;
use Config\Database;
use Throwable;

/**
 * Writes the activity feed (`feed` stories, see App\Models\FeedModel): attaches each new
 * activity row to a story by the rules of FeedAggregator, adds achievement and level
 * stories, and rebuilds the whole feed from the activity log.
 *
 * The feed is a view of the log: writing it must never fail the action that is logged.
 * Outside a transaction a failed query throws and the caller catches it; inside one
 * (creating a place with its photos) a failed query only marks the transaction failed —
 * no exception — and the whole action would roll back, so there the feed is written
 * behind a savepoint and its failure undoes the feed write alone.
 */
class FeedLibrary
{
    private const SAVEPOINT = 'feed_attach';

    private FeedModel $model;

    private BaseConnection $db;

    public function __construct()
    {
        $this->model = new FeedModel();
        $this->db    = Database::connect();
    }

    /**
     * Put a just-written activity row into a story: an open one it joins, or a new one.
     *
     * @param string      $activityId
     * @param string      $type          Activity type
     * @param string|null $userId        Null for guests
     * @param string|null $placeId
     * @param string|null $collectionId
     * @param int|null    $timestamp     Event time, now by default
     * @return string|null The story ID; null when the type is not shown in the feed, or the
     *                     feed could not be written inside the caller's transaction
     */
    public function attach(
        string $activityId,
        string $type,
        ?string $userId,
        ?string $placeId = null,
        ?string $collectionId = null,
        ?int $timestamp = null
    ): ?string {
        if (!FeedAggregator::isFeedable($type)) {
            return null;
        }

        $event = (object) [
            'type'          => $type,
            'user_id'       => $userId,
            'place_id'      => $placeId,
            'collection_id' => $collectionId,
            'created_at'    => $timestamp ?? time(),
        ];

        if ($this->db->transDepth === 0) {
            return $this->attachEvent($activityId, $event);
        }

        $statusBefore = $this->db->transStatus();
        $this->db->simpleQuery('SAVEPOINT ' . self::SAVEPOINT);

        try {
            $feedId = $this->attachEvent($activityId, $event);
            $failed = !$this->db->transStatus();
        } catch (Throwable $e) {
            $feedId = null;
            $failed = true;
            log_message('error', '{exception}', ['exception' => $e]);
        }

        if ($failed) {
            $this->db->simpleQuery('ROLLBACK TO SAVEPOINT ' . self::SAVEPOINT);

            // The caller's transaction is as good as it was before the feed write
            if ($statusBefore) {
                $this->db->resetTransStatus();
            }

            log_message('error', 'Feed: activity {id} was not attached to a story', ['id' => $activityId]);

            return null;
        }

        $this->db->simpleQuery('RELEASE SAVEPOINT ' . self::SAVEPOINT);

        return $feedId;
    }

    /**
     * A story for an earned achievement (or a higher tier of one: every tier is news).
     */
    public function achievement(string $userId, string $achievementId, ?int $timestamp = null): void
    {
        $this->insertStory((object) [
            'type'           => 'achievement',
            'user_id'        => $userId,
            'achievement_id' => $achievementId,
            'weight'         => FeedAggregator::WEIGHT['achievement'],
            'created_at'     => $timestamp ?? time(),
        ]);
    }

    /**
     * A story for a new level. Levels reached within one window share a story, which
     * shows the highest of them.
     */
    public function level(string $userId, int $level, ?int $timestamp = null): void
    {
        $timestamp ??= time();
        $since = date('Y-m-d H:i:s', $timestamp - FeedAggregator::WINDOW);

        $open = $this->model
            ->where(['user_id' => $userId, 'type' => 'level', 'created_at >=' => $since])
            ->orderBy('created_at', 'DESC')
            ->first();

        if ($open) {
            $this->model->update($open->id, [
                'level'      => max((int) $open->level, $level),
                'updated_at' => date('Y-m-d H:i:s', $timestamp),
            ]);

            return;
        }

        $this->insertStory((object) [
            'type'       => 'level',
            'user_id'    => $userId,
            'level'      => $level,
            'weight'     => FeedAggregator::WEIGHT['level'],
            'created_at' => $timestamp,
        ]);
    }

    /**
     * Regroup the whole activity log into stories and add a story for every earned
     * achievement that has none yet.
     *
     * One transaction: the feed is never seen half-built, and the events are read with
     * FOR UPDATE, so actions written meanwhile wait for the rebuild (a few seconds) and are
     * then attached live instead of being lost. Achievement and level stories are not
     * built from the log and are kept: live, every achievement tier has its own story,
     * the users_achievements table only knows the latest one.
     *
     * @return array{events: int, stories: int, achievements: int}
     */
    public function rebuild(): array
    {
        $this->db->transException(true)->transStart();

        $events = $this->db->query(
            'SELECT id, feed_id, type, user_id, place_id, collection_id, created_at
               FROM activity
              WHERE deleted_at IS NULL
                AND created_at IS NOT NULL
                AND type IN (' . implode(', ', array_map([$this->db, 'escape'], array_keys(FeedAggregator::STORY_TYPE))) . ')
              ORDER BY created_at ASC, id ASC
                FOR UPDATE'
        )->getResult();

        /** @var array<string, object[]> $open Open stories by author ('' for guests) */
        $open    = [];
        $stories = [];

        foreach ($events as $row) {
            $event = (object) [
                'type'          => $row->type,
                'user_id'       => $row->user_id,
                'place_id'      => $row->place_id,
                'collection_id' => $row->collection_id,
                'created_at'    => strtotime($row->created_at),
            ];

            $key = $row->user_id ?? '';

            // Stories past their window take no more events
            $open[$key] = array_values(array_filter(
                $open[$key] ?? [],
                static fn (object $story) => $event->created_at - $story->created_at <= FeedAggregator::WINDOW
            ));

            $story = FeedAggregator::match($event, $open[$key]);

            if ($story) {
                $joined = FeedAggregator::joinedType($event, $story);

                $story->type       = $joined['type'];
                $story->weight     = $joined['weight'];
                $story->updated_at = max($story->updated_at, $event->created_at);
            } else {
                $story = FeedAggregator::open($event);
                $story->id = $this->model->createId();
                $story->activity = [];

                $open[$key][] = $story;
                $stories[]    = $story;
            }

            $story->activity[] = $row->id;
        }

        // Earned achievements without a story (all of them on the first rebuild)
        $achievements = $this->db->query(
            "SELECT ua.user_id, ua.achievement_id, ua.earned_at
               FROM users_achievements ua
               JOIN users u ON u.id = ua.user_id AND u.deleted_at IS NULL
              WHERE NOT EXISTS (
                    SELECT 1 FROM feed f
                     WHERE f.type = 'achievement' AND f.user_id = ua.user_id AND f.achievement_id = ua.achievement_id
              )"
        )->getResult();

        $this->db->table('feed')->whereNotIn('type', FeedModel::OWN_ROW_TYPES)->delete();

        $feedRows     = [];
        $activityRows = [];

        foreach ($stories as $story) {
            $feedRows[] = $this->storyRow($story);

            foreach ($story->activity as $activityId) {
                $activityRows[] = ['id' => $activityId, 'feed_id' => $story->id];
            }
        }

        foreach ($achievements as $achievement) {
            $feedRows[] = $this->storyRow((object) [
                'id'             => $this->model->createId(),
                'type'           => 'achievement',
                'user_id'        => $achievement->user_id,
                'achievement_id' => $achievement->achievement_id,
                'weight'         => FeedAggregator::WEIGHT['achievement'],
                'created_at'     => strtotime($achievement->earned_at),
            ]);
        }

        foreach (array_chunk($feedRows, 500) as $chunk) {
            $this->db->table('feed')->insertBatch($chunk);
        }

        // Every activity row read above gets its new story; the few rows outside the feed
        // (deleted since, or not feedable) lose a link to a story that is gone
        foreach (array_chunk($activityRows, 500) as $chunk) {
            $this->db->table('activity')->updateBatch($chunk, 'id');
        }

        $this->db->table('activity')
            ->where('feed_id IS NOT NULL', null, false)
            ->groupStart()
                ->where('deleted_at IS NOT NULL', null, false)
                ->orWhereNotIn('type', array_keys(FeedAggregator::STORY_TYPE))
            ->groupEnd()
            ->update(['feed_id' => null]);

        $this->db->transComplete();

        return [
            'events'       => count($events),
            'stories'      => count($stories),
            'achievements' => count($achievements),
        ];
    }

    /**
     * Bring the given stories in line with the events left in them, after a removal: a story
     * without events is deleted, the others get the type, weight and dates of what is left.
     * A story deleted together with its place (feed.place_id cascades) has no events left.
     *
     * @param string[] $feedIds
     */
    public function refresh(array $feedIds): void
    {
        $feedIds = array_values(array_unique(array_filter($feedIds)));

        if (!$feedIds) {
            return;
        }

        $rows = $this->db->table('activity')
            ->select('feed_id, type, user_id, place_id, collection_id, created_at')
            ->whereIn('feed_id', $feedIds)
            ->where('deleted_at', null)
            ->orderBy('created_at', 'ASC')
            ->orderBy('id', 'ASC')
            ->get()
            ->getResult();

        $events = [];

        foreach ($rows as $row) {
            if (FeedAggregator::isFeedable($row->type)) {
                $row->created_at          = strtotime($row->created_at);
                $events[$row->feed_id][] = $row;
            }
        }

        foreach ($feedIds as $feedId) {
            $story = FeedAggregator::fold($events[$feedId] ?? []);

            if (!$story) {
                $this->db->table('feed')
                    ->where('id', $feedId)
                    ->whereNotIn('type', FeedModel::OWN_ROW_TYPES)
                    ->delete();
                continue;
            }

            $row = $this->storyRow($story);

            unset($row['user_id'], $row['achievement_id'], $row['level']);

            $this->db->table('feed')->where('id', $feedId)->update($row);
        }
    }

    /**
     * Attach an event to the author's open story it joins, or to a new one.
     */
    private function attachEvent(string $activityId, object $event): string
    {
        $candidates = $this->model->getOpenStories(
            $event->user_id,
            FeedAggregator::joinableTypes($event->type),
            date('Y-m-d H:i:s', $event->created_at - FeedAggregator::WINDOW),
            FeedAggregator::subject($event)
        );

        $story = FeedAggregator::match($event, $candidates);

        if ($story) {
            $this->model->touchStory(
                $story->id,
                date('Y-m-d H:i:s', $event->created_at),
                FeedAggregator::joinedType($event, $story)
            );
            $feedId = $story->id;
        } else {
            $feedId = $this->insertStory(FeedAggregator::open($event));
        }

        $this->db->table('activity')->where('id', $activityId)->update(['feed_id' => $feedId]);

        return $feedId;
    }

    /**
     * @param object $story {type, user_id, ..., created_at: int, updated_at?: int}
     * @return string The new story's ID
     */
    private function insertStory(object $story): string
    {
        $this->model->insert($this->storyRow($story));

        return $this->model->getLastGeneratedId();
    }

    /**
     * A `feed` row from a story object with timestamps.
     *
     * @return array<string, mixed>
     */
    private function storyRow(object $story): array
    {
        $row = [
            'type'           => $story->type,
            'user_id'        => $story->user_id ?? null,
            'place_id'       => $story->place_id ?? null,
            'collection_id'  => $story->collection_id ?? null,
            'achievement_id' => $story->achievement_id ?? null,
            'level'          => $story->level ?? null,
            'weight'         => $story->weight,
            'created_at'     => date('Y-m-d H:i:s', $story->created_at),
            'updated_at'     => date('Y-m-d H:i:s', $story->updated_at ?? $story->created_at),
        ];

        if (!empty($story->id)) {
            $row['id'] = $story->id;
        }

        return $row;
    }
}
