<?php

namespace App\Libraries;

use App\Models\CollectionsPlacesModel;
use App\Models\FeedModel;
use App\Models\PlacesModel;
use Config\Database;

/**
 * Turns `feed` rows into the stories of the API response. Everything a page of stories
 * points at — events, places, authors, collections, achievements — is loaded with one
 * query per kind, whatever the page size.
 *
 * Story shape (ApiModel.FeedStory on the client):
 *   id, type, weight, created (first event), updated (last event), count (events),
 *   author?                       — absent for guests;
 *   place?                        — place, photo, edit, comment: the place (list item with
 *                                   `content`, the start of its description);
 *   photos?, photosCount?         — place, photo: the photos of the story;
 *   changes?                      — edit: what changed, 'description' and/or 'cover';
 *   comment?                      — comment: {id, content};
 *   places?, placesCount?         — rating, visit, collection_place: the places, a rating
 *                                   story with the author's `value` for each;
 *   collection?                   — collection, collection_place;
 *   achievement?                  — achievement: {id, title, image, tier};
 *   level?                        — level: the level reached.
 * A story whose subject is gone (a deleted photo, comment or place) is left out.
 */
class FeedPresenter
{
    /** Photos returned per story: the card shows a few, the lightbox all of these */
    public const PHOTOS_LIMIT = 30;

    /** Places returned per multi-place story (ratings, visits, collection additions) */
    public const PLACES_LIMIT = 6;

    /** Characters of a place's description sent with it (two lines of a row card, three of a new place) */
    public const CONTENT_TRIM = 300;

    /** Mosaic covers of a collection story */
    private const COVERS_LIMIT = 4;

    private string $locale;

    public function __construct(string $locale)
    {
        $this->locale = $locale;
    }

    /**
     * @param array<int, object> $rows    `feed` rows, in the order to return
     * @param string|null        $placeId The place filter: only events about it are shown
     * @return array<int, array<string, mixed>>
     */
    public function present(array $rows, ?string $placeId = null): array
    {
        if (empty($rows)) {
            return [];
        }

        $model     = new FeedModel();
        $storyIds  = array_column($rows, 'id');
        $eventRows = $model->getStoryEvents($storyIds, $placeId);
        $counts    = $model->getStoryCounts($storyIds, $placeId);
        $events    = [];

        foreach ($eventRows as $event) {
            $events[$event->feed_id][] = $event;
        }

        $places       = $this->loadPlaces(array_merge(array_column($rows, 'place_id'), array_column($eventRows, 'place_id')));
        $authors      = $this->loadAuthors(array_column($rows, 'user_id'));
        $collections  = $this->loadCollections(array_column($rows, 'collection_id'));
        $achievements = $this->loadAchievements(array_column($rows, 'achievement_id'));

        $stories = [];

        foreach ($rows as $row) {
            $story = $this->story($row, $events[$row->id] ?? [], $counts[$row->id] ?? null, $places, $collections, $achievements);

            if ($story === null) {
                continue;
            }

            if ($row->user_id && isset($authors[$row->user_id])) {
                $story['author'] = $authors[$row->user_id];
            }

            $stories[] = $story;
        }

        return $stories;
    }

    /**
     * @param object             $row
     * @param array<int, object> $events The latest events (FeedModel::EVENTS_PER_STORY)
     * @param object|null        $counts All events of the story {events, photos, places}
     * @param array<string, object> $places
     * @param array<string, array>  $collections
     * @param array<string, array>  $achievements
     * @return array<string, mixed>|null Null when there is nothing left to show
     */
    protected function story(
        object $row,
        array $events,
        ?object $counts,
        array $places,
        array $collections,
        array $achievements
    ): ?array {
        $story = [
            'id'      => $row->id,
            'type'    => $row->type,
            'weight'  => (int) $row->weight,
            'created' => new \DateTime($row->created_at),
            'updated' => new \DateTime($row->updated_at),
            'count'   => max(count($events), $counts->events ?? 0),
        ];

        switch ($row->type) {
            case 'place':
            case 'photo':
                $place = $places[$row->place_id] ?? null;
                $photos = $this->photos($events);

                if (!$place || ($row->type === 'photo' && empty($photos))) {
                    return null;
                }

                $story['place'] = $place->item;

                if (!empty($photos)) {
                    $story['photos']      = array_slice($photos, 0, self::PHOTOS_LIMIT);
                    $story['photosCount'] = max(count($photos), $counts->photos ?? 0);
                }

                return $story;

            case 'edit':
                if (!isset($places[$row->place_id]) || empty($events)) {
                    return null;
                }

                $story['place']   = $places[$row->place_id]->item;
                $story['changes'] = array_values(array_unique(array_map(
                    static fn (object $event) => $event->type === 'cover' ? 'cover' : 'description',
                    $events
                )));

                return $story;

            case 'comment':
                $comment = null;

                foreach ($events as $event) {
                    if ($event->comment_id) {
                        $comment = ['id' => $event->comment_id, 'content' => $event->comment];
                    }
                }

                if (!$comment || !isset($places[$row->place_id])) {
                    return null;
                }

                $story['place']   = $places[$row->place_id]->item;
                $story['comment'] = $comment;

                return $story;

            case 'rating':
            case 'visit':
            case 'collection_place':
                $entries = $this->placeEntries($events, $places, $row->type === 'rating');

                if (empty($entries)) {
                    return null;
                }

                if ($row->type === 'collection_place') {
                    if (!isset($collections[$row->collection_id])) {
                        return null;
                    }

                    $story['collection'] = $collections[$row->collection_id];
                }

                $story['places']      = array_slice($entries, 0, self::PLACES_LIMIT);
                $story['placesCount'] = max(count($entries), $counts->places ?? 0);

                return $story;

            case 'collection':
                if (!isset($collections[$row->collection_id])) {
                    return null;
                }

                $story['collection'] = $collections[$row->collection_id];

                return $story;

            case 'achievement':
                if (!isset($achievements[$row->achievement_id])) {
                    return null;
                }

                $story['achievement'] = $achievements[$row->achievement_id];

                return $story;

            case 'level':
                $story['level'] = (int) $row->level;

                return $story;
        }

        return null;
    }

    /**
     * The photos of a story's events (deleted ones have no file name and are skipped).
     *
     * @param array<int, object> $events
     * @return array<int, array<string, mixed>>
     */
    protected function photos(array $events): array
    {
        $photos = [];

        foreach ($events as $event) {
            if ($event->type !== 'photo' || empty($event->filename)) {
                continue;
            }

            $path = PATH_PHOTOS . $event->place_id . '/';

            $photos[] = [
                'id'      => $event->photo_id,
                'full'    => $path . $event->filename . '.' . $event->extension,
                'preview' => $path . $event->filename . '_preview.' . $event->extension,
                // 0 when unknown: the preview is a crop, its size would distort the full photo
                'width'   => (int) ($event->width ?? 0),
                'height'  => (int) ($event->height ?? 0),
                'placeId' => $event->place_id,
            ];
        }

        return $photos;
    }

    /**
     * Distinct places of a multi-place story, the latest event of each winning; with
     * $withRating the author's score is attached as `value` and unscored events are skipped.
     *
     * @param array<int, object>    $events
     * @param array<string, object> $places
     * @return array<int, object>
     */
    protected function placeEntries(array $events, array $places, bool $withRating): array
    {
        $entries = [];

        foreach (array_reverse($events) as $event) {
            if (!$event->place_id || isset($entries[$event->place_id]) || !isset($places[$event->place_id])) {
                continue;
            }

            if ($withRating && !$event->rating) {
                continue;
            }

            $entry = clone $places[$event->place_id]->item;

            if ($withRating) {
                $entry->value = (int) $event->rating;
            }

            $entries[$event->place_id] = $entry;
        }

        return array_values($entries);
    }

    /**
     * Places as list items with the start of their description, by ID.
     *
     * @param array<int, string|null> $ids
     * @return array<string, object> {item: object}
     */
    protected function loadPlaces(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));

        if (empty($ids)) {
            return [];
        }

        $rows = (new PlacesModel())
            ->applyListSelect()
            ->whereIn('places.id', $ids)
            ->where('places.deleted_at', null)
            ->get()
            ->getResult();

        $content = new PlacesContent(self::CONTENT_TRIM);
        $content->translate(array_column($rows, 'id'));

        $formatter = new PlaceFormatterLibrary();
        $places    = [];

        foreach ($rows as $row) {
            $formatter->formatListRow($row, $this->locale, $content->title($row->id), $content->content($row->id));

            $places[$row->id] = (object) ['item' => $row];
        }

        return $places;
    }

    /**
     * @param array<int, string|null> $ids
     * @return array<string, array{id: string, name: string, avatar: ?string}>
     */
    protected function loadAuthors(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));

        if (empty($ids)) {
            return [];
        }

        $rows = Database::connect()->table('users')
            ->select('id, name, avatar')
            ->whereIn('id', $ids)
            ->where('deleted_at', null)
            ->get()
            ->getResult();

        $avatars = new AvatarLibrary();
        $authors = [];

        foreach ($rows as $row) {
            $authors[$row->id] = [
                'id'     => $row->id,
                'name'   => $row->name,
                'avatar' => $avatars->buildPath($row->id, $row->avatar, 'small'),
            ];
        }

        return $authors;
    }

    /**
     * Visible collections with the covers of their first places, by ID.
     *
     * @param array<int, string|null> $ids
     * @return array<string, array<string, mixed>>
     */
    protected function loadCollections(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));

        if (empty($ids)) {
            return [];
        }

        $rows = Database::connect()->table('collections')
            ->select('id, slug, title, title_en, places_count')
            ->whereIn('id', $ids)
            ->where('deleted_at', null)
            ->where('hidden', 0)
            ->get()
            ->getResult();

        $coverPlaceIds = (new CollectionsPlacesModel())->getCoverPlaceIds(array_column($rows, 'id'), self::COVERS_LIMIT);
        $formatter     = new PlaceFormatterLibrary();
        $collections   = [];

        foreach ($rows as $row) {
            $covers = [];

            foreach ($coverPlaceIds[$row->id] ?? [] as $coverPlaceId) {
                $cover = $formatter->formatCover($coverPlaceId, 1);

                if ($cover) {
                    $covers[] = $cover;
                }
            }

            $collections[$row->id] = [
                'id'          => $row->id,
                'slug'        => $row->slug,
                'title'       => $this->locale === 'en' && !empty($row->title_en) ? $row->title_en : $row->title,
                'placesCount' => (int) $row->places_count,
                'covers'      => $covers,
            ];
        }

        return $collections;
    }

    /**
     * @param array<int, string|null> $ids
     * @return array<string, array{id: string, title: string, image: ?string, tier: string}>
     */
    protected function loadAchievements(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));

        if (empty($ids)) {
            return [];
        }

        $rows = Database::connect()->table('achievements')
            ->select('id, title_en, title_ru, image, tier')
            ->whereIn('id', $ids)
            ->get()
            ->getResult();

        $achievements = [];

        foreach ($rows as $row) {
            $achievements[$row->id] = [
                'id'    => $row->id,
                'title' => $this->locale === 'en' ? $row->title_en : $row->title_ru,
                'image' => $row->image,
                'tier'  => $row->tier,
            ];
        }

        return $achievements;
    }
}
