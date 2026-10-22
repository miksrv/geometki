<?php

namespace App\Libraries;

/**
 * The rules that turn activity rows into feed stories. Pure: no database, so the same
 * rules serve the live path (FeedLibrary::attach(), one event against the author's open
 * stories) and the rebuild (FeedLibrary::rebuild(), the whole log in time order).
 *
 * A story collects events for WINDOW seconds after its first one, so it is bounded: a
 * user who rates one place a day gets a story a day, not one that grows forever.
 *
 *  - place, comment — always a story of their own;
 *  - photo — joins the author's new-place story of that place, else their photo story of it;
 *  - photo_link — a PastVu / Commons photo linked to a place: joins the author's
 *    linked-photos story of that place; the uploads and the new place only in one sitting;
 *  - edit, cover — join the author's new-place story of that place (part of creating it),
 *    else their edit story of it ("updated the description and the cover");
 *  - rating, visit — one story per author across places ("rated 5 places"); guest
 *    ratings (no author) share one story;
 *  - one sitting: within SESSION_WINDOW of a story's first event, photos, linked photos,
 *    edits and covers of a place join the author's story of that place of any of these kinds
 *    (new place, photos, linked photos, edits), so creating a place and linking photos to it
 *    is one story; the story takes the most prominent kind (SESSION_STORIES);
 *  - collection_place — joins the "created a collection" story of that collection, else
 *    the author's story of adding places to it;
 *  - collection — fires once the collection has enough places, after they were added:
 *    it takes over the author's story of adding them, which becomes "created a collection";
 *  - bookmark — never in the feed: bookmarks are private.
 */
final class FeedAggregator
{
    /** Seconds a story collects events for, counted from its first event */
    public const WINDOW = 86400;

    /** Seconds within which all of an author's photos, linked photos and edits of a place make one story */
    public const SESSION_WINDOW = 900;

    /** Story kinds of one sitting with a place, the most prominent first: a merged story takes the first of them */
    public const SESSION_STORIES = ['place', 'photo', 'photo_link', 'edit'];

    /** Activity types that join any story of one sitting with their place (SESSION_STORIES) */
    private const SESSION_EVENTS = ['photo', 'photo_link', 'edit', 'cover'];

    /** The story an event of each activity type opens when it joins none */
    public const STORY_TYPE = [
        'place'            => 'place',
        'photo'            => 'photo',
        'photo_link'       => 'photo_link',
        'edit'             => 'edit',
        'cover'            => 'edit',
        'comment'          => 'comment',
        'rating'           => 'rating',
        'visit'            => 'visit',
        'collection'       => 'collection',
        'collection_place' => 'collection_place',
    ];

    /** Stories an event of each activity type may join, the preferred first */
    public const JOINS = [
        'photo'            => ['place', 'photo'],
        'photo_link'       => ['photo_link'],
        'edit'             => ['place', 'edit'],
        'cover'            => ['place', 'edit'],
        'rating'           => ['rating'],
        'visit'            => ['visit'],
        'collection_place' => ['collection', 'collection_place'],
        'collection'       => ['collection_place'],
    ];

    /** Stories an event of each activity type turns into its own story type when it joins them */
    public const PROMOTES = [
        'collection' => ['collection_place'],
    ];

    /**
     * How prominent a story is: 3 — a card with a picture (new place, photos, linked photos, collection),
     * 2 — a card of its own (review, achievement, level), 1 — a compact line (edits,
     * ratings, visits, places added to a collection). The home page shows weight >= 2.
     */
    public const WEIGHT = [
        'place'            => 3,
        'photo'            => 3,
        'photo_link'       => 3,
        'collection'       => 3,
        'comment'          => 2,
        'achievement'      => 2,
        'level'            => 2,
        'edit'             => 1,
        'rating'           => 1,
        'visit'            => 1,
        'collection_place' => 1,
    ];

    /** Story types that are about one place (feed.place_id is set) */
    private const PLACE_STORIES = ['place', 'photo', 'photo_link', 'edit', 'comment'];

    /** Story types that are about one collection (feed.collection_id is set) */
    private const COLLECTION_STORIES = ['collection', 'collection_place'];

    /**
     * Whether an activity type ever shows in the feed.
     */
    public static function isFeedable(string $activityType): bool
    {
        return isset(self::STORY_TYPE[$activityType]);
    }

    /**
     * Story types an event may join; empty when it always opens its own story.
     *
     * @return string[]
     */
    public static function joinableTypes(string $activityType): array
    {
        if (in_array($activityType, self::SESSION_EVENTS, true)) {
            return self::SESSION_STORIES;
        }

        return self::JOINS[$activityType] ?? [];
    }

    /**
     * The column a story the event may join must match, as [column => value]: the place for
     * photos, linked photos, edits and covers, the collection for collection events, nothing for ratings
     * and visits (their stories span places). Narrows the candidate query of the live path.
     *
     * @param object $event {type, place_id, collection_id}
     * @return array<string, string|null>
     */
    public static function subject(object $event): array
    {
        return match ($event->type) {
            'photo', 'photo_link', 'edit', 'cover' => ['place_id' => $event->place_id ?? null],
            'collection', 'collection_place' => ['collection_id' => $event->collection_id ?? null],
            default                          => [],
        };
    }

    /**
     * The open story the event joins, or null when it opens a new one.
     *
     * @param object   $event   {type, user_id, place_id, collection_id, created_at: int timestamp}
     * @param object[] $stories Candidate stories {id, type, user_id, place_id, collection_id,
     *                          created_at: int timestamp}, in any order
     */
    public static function match(object $event, array $stories): ?object
    {
        $types = self::joinableTypes($event->type);

        if (empty($types)) {
            return null;
        }

        $best = null;
        $bestRank = PHP_INT_MAX;

        foreach ($stories as $story) {
            $rank = array_search($story->type, $types, true);

            if ($rank === false || !self::fits($event, $story)) {
                continue;
            }

            // The preferred story type wins; among the same type, the latest story
            if ($rank < $bestRank || ($rank === $bestRank && $story->created_at > $best->created_at)) {
                $best = $story;
                $bestRank = $rank;
            }
        }

        return $best;
    }

    /**
     * The type and weight a story takes when the event joins it: its own, unless the
     * event promotes it (PROMOTES) or is a more prominent kind of the same sitting
     * (SESSION_STORIES: photos turn an edit story into a photo story).
     *
     * @return array{type: string, weight: int}
     */
    public static function joinedType(object $event, object $story): array
    {
        if (in_array($story->type, self::PROMOTES[$event->type] ?? [], true)) {
            $type = self::STORY_TYPE[$event->type];

            return ['type' => $type, 'weight' => self::WEIGHT[$type]];
        }

        $own  = array_search(self::STORY_TYPE[$event->type] ?? null, self::SESSION_STORIES, true);
        $rank = array_search($story->type, self::SESSION_STORIES, true);

        if ($own !== false && $rank !== false && $own < $rank) {
            $type = self::SESSION_STORIES[$own];

            return ['type' => $type, 'weight' => self::WEIGHT[$type]];
        }

        return ['type' => $story->type, 'weight' => self::WEIGHT[$story->type]];
    }

    /**
     * A new story for an event that joins none.
     *
     * @param object $event {type, user_id, place_id, collection_id, created_at: int timestamp}
     * @return object {type, user_id, place_id, collection_id, weight, created_at, updated_at}
     */
    public static function open(object $event): object
    {
        $type = self::STORY_TYPE[$event->type];

        return (object) [
            'type'          => $type,
            'user_id'       => $event->user_id ?? null,
            'place_id'      => in_array($type, self::PLACE_STORIES, true) ? ($event->place_id ?? null) : null,
            'collection_id' => in_array($type, self::COLLECTION_STORIES, true) ? ($event->collection_id ?? null) : null,
            'weight'        => self::WEIGHT[$type],
            'created_at'    => $event->created_at,
            'updated_at'    => $event->created_at,
        ];
    }

    /**
     * The story its events make, folded in time order as they were attached: what is left
     * of a story after some of its events were removed.
     *
     * @param object[] $events {type, user_id, place_id, collection_id, created_at: int}, oldest first
     * @return object|null {type, user_id, place_id, collection_id, weight, created_at, updated_at}; null without events
     */
    public static function fold(array $events): ?object
    {
        $story = null;

        foreach ($events as $event) {
            if (!$story) {
                $story = self::open($event);
                continue;
            }

            $joined = self::joinedType($event, $story);

            $story->type       = $joined['type'];
            $story->weight     = $joined['weight'];
            $story->updated_at = max($story->updated_at, $event->created_at);
        }

        return $story;
    }

    /**
     * Same author (guests share one), within the story's window and about the same
     * place or collection when the story is about one. The window is a day for the joins
     * of JOINS and SESSION_WINDOW for the other joins of one sitting.
     */
    private static function fits(object $event, object $story): bool
    {
        if (($story->user_id ?? null) !== ($event->user_id ?? null)) {
            return false;
        }

        // Only guest ratings are pooled; any other event without an author stands alone
        if ($event->user_id === null && $event->type !== 'rating') {
            return false;
        }

        $age = $event->created_at - $story->created_at;

        $window = in_array($story->type, self::JOINS[$event->type] ?? [], true) ? self::WINDOW : self::SESSION_WINDOW;

        if ($age < 0 || $age > $window) {
            return false;
        }

        if (in_array($story->type, self::PLACE_STORIES, true)) {
            return $story->place_id !== null && $story->place_id === ($event->place_id ?? null);
        }

        if (in_array($story->type, self::COLLECTION_STORIES, true)) {
            return $story->collection_id !== null && $story->collection_id === ($event->collection_id ?? null);
        }

        return true;
    }
}
