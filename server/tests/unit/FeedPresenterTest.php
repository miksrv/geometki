<?php

use App\Libraries\FeedPresenter;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class FeedPresenterTest extends CIUnitTestCase
{
    private function present(string $type, array $events): ?array
    {
        $presenter = new class ('ru') extends FeedPresenter {
            public function show(object $row, array $events, array $places): ?array
            {
                return $this->story($row, $events, null, $places, [], []);
            }
        };

        $row = (object) [
            'id' => 'f1', 'type' => $type, 'weight' => 3, 'place_id' => 'p1',
            'created_at' => '2026-10-14 10:00:00', 'updated_at' => '2026-10-14 10:05:00',
        ];

        return $presenter->show($row, $events, ['p1' => (object) ['item' => ['id' => 'p1']]]);
    }

    private function event(string $type): object
    {
        return (object) ['type' => $type, 'place_id' => 'p1', 'filename' => null, 'ep_id' => null];
    }

    public function testEditsOfASittingOutliveItsDeletedPhotos(): void
    {
        $story = $this->present('photo', [$this->event('photo'), $this->event('edit'), $this->event('cover')]);

        $this->assertSame('edit', $story['type']);
        $this->assertSame(1, $story['weight']);
        $this->assertSame(['description', 'cover'], $story['changes']);
        $this->assertArrayNotHasKey('photos', $story);
    }

    public function testAPhotoStoryWithoutPhotosOrEditsIsLeftOut(): void
    {
        $this->assertNull($this->present('photo_link', [$this->event('photo_link')]));
    }

    public function testEditStoryListsItsChanges(): void
    {
        $this->assertSame(['cover'], $this->present('edit', [$this->event('cover')])['changes']);
    }
}
