<?php

use App\Controllers\Feed;
use App\Libraries\FeedAggregator;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the feed grouping rules (App\Libraries\FeedAggregator) and the feed
 * cursor (App\Controllers\Feed). All tests are pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class FeedAggregatorTest extends CIUnitTestCase
{
    private const T = 1_760_000_000;

    private function event(string $type, ?string $user = 'u1', ?string $place = 'p1', ?string $collection = null, int $at = self::T): object
    {
        return (object) [
            'type'          => $type,
            'user_id'       => $user,
            'place_id'      => $place,
            'collection_id' => $collection,
            'created_at'    => $at,
        ];
    }

    private function story(string $type, ?string $user = 'u1', ?string $place = 'p1', ?string $collection = null, int $at = self::T, string $id = 's1'): object
    {
        return (object) [
            'id'            => $id,
            'type'          => $type,
            'user_id'       => $user,
            'place_id'      => $place,
            'collection_id' => $collection,
            'created_at'    => $at,
        ];
    }

    // =========================================================================
    // What shows in the feed
    // =========================================================================

    public function testBookmarksNeverShowInTheFeed(): void
    {
        $this->assertFalse(FeedAggregator::isFeedable('bookmark'));
    }

    public function testEveryOtherActivityTypeShows(): void
    {
        foreach (['place', 'photo', 'edit', 'cover', 'comment', 'rating', 'visit', 'collection', 'collection_place'] as $type) {
            $this->assertTrue(FeedAggregator::isFeedable($type), $type);
        }
    }

    // =========================================================================
    // Stories of their own
    // =========================================================================

    public function testNewPlaceAlwaysOpensAStory(): void
    {
        $stories = [$this->story('place')];

        $this->assertNull(FeedAggregator::match($this->event('place'), $stories));
    }

    public function testEachCommentIsAStory(): void
    {
        $stories = [$this->story('comment')];

        $this->assertNull(FeedAggregator::match($this->event('comment'), $stories));
    }

    // =========================================================================
    // Photos, edits and covers
    // =========================================================================

    public function testPhotoJoinsTheNewPlaceStoryOfThatPlace(): void
    {
        $place = $this->story('place', id: 'place-story');
        $photo = $this->story('photo', id: 'photo-story');

        $this->assertSame('place-story', FeedAggregator::match($this->event('photo', at: self::T + 60), [$photo, $place])->id);
    }

    public function testPhotoJoinsThePhotoStoryWithoutANewPlace(): void
    {
        $stories = [$this->story('photo', id: 'photo-story')];

        $this->assertSame('photo-story', FeedAggregator::match($this->event('photo', at: self::T + 60), $stories)->id);
    }

    public function testPhotoOfAnotherPlaceOpensAStory(): void
    {
        $stories = [$this->story('photo', place: 'p2')];

        $this->assertNull(FeedAggregator::match($this->event('photo'), $stories));
    }

    public function testPhotoOfAnotherAuthorOpensAStory(): void
    {
        $stories = [$this->story('photo', user: 'u2')];

        $this->assertNull(FeedAggregator::match($this->event('photo'), $stories));
    }

    public function testEditAndCoverShareAnEditStory(): void
    {
        $stories = [$this->story('edit', id: 'edit-story')];

        $this->assertSame('edit-story', FeedAggregator::match($this->event('cover', at: self::T + 5), $stories)->id);
        $this->assertSame('edit', FeedAggregator::open($this->event('cover'))->type);
    }

    public function testEditRightAfterCreatingThePlaceIsPartOfIt(): void
    {
        $stories = [$this->story('place', id: 'place-story'), $this->story('edit', id: 'edit-story')];

        $this->assertSame('place-story', FeedAggregator::match($this->event('edit', at: self::T + 5), $stories)->id);
    }

    // =========================================================================
    // The window
    // =========================================================================

    public function testStoryTakesEventsWithinItsWindow(): void
    {
        $stories = [$this->story('photo')];

        $this->assertNotNull(FeedAggregator::match($this->event('photo', at: self::T + FeedAggregator::WINDOW), $stories));
    }

    public function testStoryPastItsWindowIsClosed(): void
    {
        $stories = [$this->story('photo')];

        $this->assertNull(FeedAggregator::match($this->event('photo', at: self::T + FeedAggregator::WINDOW + 1), $stories));
    }

    public function testWindowCountsFromTheFirstEventNotTheLast(): void
    {
        // A story that started two days ago takes nothing, however recently it grew
        $stories = [$this->story('rating', place: null, at: self::T - 2 * FeedAggregator::WINDOW)];

        $this->assertNull(FeedAggregator::match($this->event('rating'), $stories));
    }

    public function testEventOlderThanTheStoryDoesNotJoinIt(): void
    {
        $stories = [$this->story('photo', at: self::T + 100)];

        $this->assertNull(FeedAggregator::match($this->event('photo'), $stories));
    }

    // =========================================================================
    // Ratings and visits span places
    // =========================================================================

    public function testRatingsOfDifferentPlacesShareAStory(): void
    {
        $stories = [$this->story('rating', place: null)];

        $this->assertNotNull(FeedAggregator::match($this->event('rating', place: 'p9'), $stories));
        $this->assertNull(FeedAggregator::open($this->event('rating'))->place_id);
    }

    public function testGuestRatingsAreOneStory(): void
    {
        $stories = [$this->story('rating', user: null, place: null)];

        $this->assertNotNull(FeedAggregator::match($this->event('rating', user: null, place: 'p9'), $stories));
    }

    public function testGuestAndUserRatingsAreNotMixed(): void
    {
        $stories = [$this->story('rating', user: null, place: null)];

        $this->assertNull(FeedAggregator::match($this->event('rating'), $stories));
    }

    public function testVisitsShareAStory(): void
    {
        $stories = [$this->story('visit', place: null)];

        $this->assertNotNull(FeedAggregator::match($this->event('visit', place: 'p5'), $stories));
    }

    // =========================================================================
    // Collections
    // =========================================================================

    public function testPlacesAddedToANewCollectionJoinIt(): void
    {
        $stories = [$this->story('collection', place: null, collection: 'c1', id: 'created')];

        $this->assertSame('created', FeedAggregator::match($this->event('collection_place', collection: 'c1'), $stories)->id);
    }

    public function testPlacesAddedToAnotherCollectionOpenAStory(): void
    {
        $stories = [$this->story('collection_place', place: null, collection: 'c1')];

        $this->assertNull(FeedAggregator::match($this->event('collection_place', collection: 'c2'), $stories));
    }

    public function testCreatingACollectionTakesOverThePlacesAddedBefore(): void
    {
        $added = $this->story('collection_place', place: null, collection: 'c1', id: 'added');
        $event = $this->event('collection', place: null, collection: 'c1', at: self::T + 30);

        $story = FeedAggregator::match($event, [$added]);

        $this->assertSame('added', $story->id);
        $this->assertSame(['type' => 'collection', 'weight' => 3], FeedAggregator::joinedType($event, $story));
    }

    public function testJoiningKeepsTheStoryType(): void
    {
        $story = $this->story('place');

        $this->assertSame(['type' => 'place', 'weight' => 3], FeedAggregator::joinedType($this->event('photo'), $story));
    }

    // =========================================================================
    // New stories
    // =========================================================================

    public function testOpenSetsTheSubjectAndWeight(): void
    {
        $story = FeedAggregator::open($this->event('photo', at: self::T));

        $this->assertSame('photo', $story->type);
        $this->assertSame('p1', $story->place_id);
        $this->assertNull($story->collection_id);
        $this->assertSame(3, $story->weight);
        $this->assertSame(self::T, $story->created_at);
        $this->assertSame(self::T, $story->updated_at);
    }

    public function testCompactStoriesWeighOne(): void
    {
        foreach (['edit', 'rating', 'visit', 'collection_place'] as $type) {
            $this->assertSame(1, FeedAggregator::WEIGHT[$type], $type);
        }
    }

    // =========================================================================
    // Subject of the candidate query
    // =========================================================================

    public function testPhotosEditsAndCoversLookForStoriesOfTheirPlace(): void
    {
        foreach (['photo', 'edit', 'cover'] as $type) {
            $this->assertSame(['place_id' => 'p1'], FeedAggregator::subject($this->event($type)), $type);
        }
    }

    public function testCollectionEventsLookForStoriesOfTheirCollection(): void
    {
        foreach (['collection', 'collection_place'] as $type) {
            $this->assertSame(['collection_id' => 'c1'], FeedAggregator::subject($this->event($type, collection: 'c1')), $type);
        }
    }

    public function testRatingsAndVisitsLookAtAllTheAuthorsStories(): void
    {
        $this->assertSame([], FeedAggregator::subject($this->event('rating')));
        $this->assertSame([], FeedAggregator::subject($this->event('visit')));
    }

    // =========================================================================
    // Cursor
    // =========================================================================

    public function testCursorRoundTrip(): void
    {
        $cursor = Feed::makeCursor('2026-10-13 19:38:30', 'b13fcf30fd8ed');

        $this->assertSame(
            ['at' => '2026-10-13 19:38:30', 'id' => 'b13fcf30fd8ed'],
            Feed::parseCursor($cursor)
        );
    }

    public function testMalformedCursorIsIgnored(): void
    {
        $this->assertNull(Feed::parseCursor(''));
        $this->assertNull(Feed::parseCursor('2026-10-13'));
        $this->assertNull(Feed::parseCursor("1760000000-x' OR 1=1"));
    }

    public function testCalendarTakesTheViewersTimeZone(): void
    {
        $this->assertSame('America/Los_Angeles', Feed::timeZone('America/Los_Angeles')->getName());
        $this->assertSame('Europe/Kiev', Feed::timeZone('Europe/Kiev')->getName());
    }

    public function testCalendarFallsBackToTheSiteTimeZone(): void
    {
        $this->assertSame(SITE_TIMEZONE, Feed::timeZone(null)->getName());
        $this->assertSame(SITE_TIMEZONE, Feed::timeZone('')->getName());
        $this->assertSame(SITE_TIMEZONE, Feed::timeZone('Mars/Olympus')->getName());
        $this->assertSame(SITE_TIMEZONE, Feed::timeZone('+03:00')->getName());
        $this->assertSame(SITE_TIMEZONE, Feed::timeZone(['Europe/Moscow'])->getName());
    }
}
