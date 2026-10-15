<?php

use App\Libraries\NotificationSettings;
use App\Libraries\Push\PushEndpoint;
use App\Libraries\Push\PushPayload;
use App\Libraries\Push\PushQueue;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Notifications;

/**
 * Push notifications without the database or a push service: what a push
 * shows, the quiet hours, which notifications are pushable.
 *
 * @internal
 */
final class PushTest extends CIUnitTestCase
{
    private function event(string $type, string $placeId, string $title, array $extra = []): array
    {
        return $extra + [
            'activityId' => 'a-' . $type . $placeId,
            'type'       => $type,
            'placeId'    => $placeId,
            'slug'       => 'slug-' . $placeId,
            'title'      => $title,
            'hasCover'   => false,
            'actor'      => 'traveler42',
            'comment'    => null,
            'rating'     => null,
        ];
    }

    public function testOneEventNamesThePlaceAndWhoDidWhat(): void
    {
        $payload = PushPayload::activity([
            $this->event('comment', 'p1', 'Водопад', ['comment' => "Были   здесь\nв мае", 'hasCover' => true]),
        ], 'u1', 'ru');

        $this->assertSame('Водопад', $payload['title']);
        $this->assertSame('Новый комментарий · traveler42: «Были здесь в мае»', $payload['body']);
        $this->assertStringEndsWith('/places/p1-slug-p1', $payload['url']);
        $this->assertStringEndsWith('/uploads/places/p1/cover_preview.jpg', $payload['image']);
        $this->assertSame('place-p1', $payload['tag'], 'a newer push about the place replaces the older one');
        $this->assertSame('ru', $payload['lang']);
    }

    public function testRatingAndGuest(): void
    {
        $payload = PushPayload::activity([$this->event('rating', 'p1', 'Place', ['rating' => 5, 'actor' => null])], 'u1', 'en');

        $this->assertSame('New rating · A guest · 5 out of 5', $payload['body']);
        $this->assertArrayNotHasKey('image', $payload, 'no cover, no image');
        $this->assertStringContainsString('/en/places/', $payload['url']);
    }

    public function testSeveralEventsAreOnePushListingThePlaces(): void
    {
        $payload = PushPayload::activity([
            $this->event('comment', 'p1', 'Водопад'),
            $this->event('rating', 'p1', 'Водопад'),
            $this->event('photo', 'p2', 'Пещера'),
            $this->event('visit', 'p3', 'Гора'),
            $this->event('bookmark', 'p4', 'Озеро'),
        ], 'u1', 'ru');

        $this->assertSame('На ваших местах 5 новых событий', $payload['title']);
        $this->assertSame("Водопад: новый комментарий, новая оценка\nПещера: новая фотография\nГора: отмечено посещение\nи ещё 1 место", $payload['body']);
        $this->assertStringEndsWith('/users/u1/places', $payload['url'], 'several places: the user\'s places');
        $this->assertSame('places', $payload['tag']);
    }

    public function testSeveralEventsOnOnePlaceOpenThePlace(): void
    {
        $payload = PushPayload::activity([
            $this->event('comment', 'p1', 'Водопад'),
            $this->event('photo', 'p1', 'Водопад'),
        ], 'u1', 'ru');

        $this->assertStringEndsWith('/places/p1-slug-p1', $payload['url']);
    }

    public function testAchievementAndLevel(): void
    {
        $achievement = PushPayload::achievement(['title_ru' => 'Серия', 'title_en' => 'Streak', 'image' => 'uploads/achievements/a.png'], 'u1', 'en');
        $this->assertSame('New achievement', $achievement['title']);
        $this->assertStringContainsString('Streak', $achievement['body']);
        $this->assertStringEndsWith('/uploads/achievements/a.png', $achievement['icon']);
        $this->assertStringEndsWith('/en/users/u1/achievements', $achievement['url']);

        $level = PushPayload::level(['level' => 7, 'title' => 'x'], 'u1', 'ru');
        $this->assertSame('Новый уровень: 7', $level['title']);
        $this->assertStringEndsWith('/users/u1', $level['url']);
        $this->assertStringEndsWith('/android-chrome-192x192.png', $level['icon']);
    }

    public function testPushTextsExistInBothLocales(): void
    {
        $ru = require APPPATH . 'Language/ru/Push.php';
        $en = require APPPATH . 'Language/en/Push.php';

        $this->assertSame([], array_diff(array_keys($ru), array_keys($en)));
        $this->assertSame([], array_diff(array_keys($en), array_keys($ru)));

        foreach ((new Notifications())->activityTypes as $type) {
            $this->assertArrayHasKey('event_' . $type, $ru, $type);
        }
    }

    public function testQuietHours(): void
    {
        $at = static fn (string $local, string $tz) => (new DateTime($local, new DateTimeZone($tz)))->getTimestamp();

        // Moscow, 01:15 → wait until 08:00 the same morning
        $this->assertSame(6 * 3600 + 45 * 60, PushQueue::secondsUntilQuietEnd('Europe/Moscow', 23, 8, $at('2026-10-15 01:15', 'Europe/Moscow')));
        // 23:30 → until 08:00 the next morning
        $this->assertSame(8 * 3600 + 30 * 60, PushQueue::secondsUntilQuietEnd('Europe/Moscow', 23, 8, $at('2026-10-14 23:30', 'Europe/Moscow')));
        // Daytime: no wait
        $this->assertSame(0, PushQueue::secondsUntilQuietEnd('Europe/Moscow', 23, 8, $at('2026-10-14 14:00', 'Europe/Moscow')));
        $this->assertSame(0, PushQueue::secondsUntilQuietEnd('Europe/Moscow', 23, 8, $at('2026-10-15 08:00', 'Europe/Moscow')));
        // The device's zone counts: 01:00 in Moscow is 17:00 in New York
        $this->assertSame(0, PushQueue::secondsUntilQuietEnd('America/New_York', 23, 8, $at('2026-10-15 01:00', 'Europe/Moscow')));
        // Unknown or broken zone: Moscow
        $this->assertGreaterThan(0, PushQueue::secondsUntilQuietEnd('Nowhere/Bad', 23, 8, $at('2026-10-15 03:00', 'Europe/Moscow')));
        $this->assertGreaterThan(0, PushQueue::secondsUntilQuietEnd(null, 23, 8, $at('2026-10-15 03:00', 'Europe/Moscow')));
    }

    public function testPushableNotifications(): void
    {
        $settings = new NotificationSettings(new Notifications());

        foreach (PushQueue::NOTIFY_TYPES as $notifyType => $pushType) {
            $this->assertTrue($settings->isEnabled(null, 'push', $pushType), "{$notifyType} → {$pushType} is a push type on by default");
        }

        $this->assertArrayNotHasKey('experience', PushQueue::NOTIFY_TYPES, '"+N experience" is never pushed');
        $this->assertArrayNotHasKey('place', PushQueue::NOTIFY_TYPES);
    }

    public function testOnlyPushServiceEndpointsAreAccepted(): void
    {
        foreach ([
            'https://fcm.googleapis.com/fcm/send/abc',
            'https://updates.push.services.mozilla.com/wpush/v2/abc',
            'https://web.push.apple.com/QGv9',
            'https://wns2-par02p.notify.windows.com/w/?token=abc',
            'https://fcm.googleapis.com:443/fcm/send/abc',
        ] as $url) {
            $this->assertTrue(PushEndpoint::isAllowed($url), $url);
        }

        foreach ([
            'http://fcm.googleapis.com/fcm/send/abc',          // not https
            'https://127.0.0.1/push',                          // an internal address
            'https://169.254.169.254/latest/meta-data',
            'https://localhost/a',
            'https://fcm.googleapis.com:8443/x',                // another port
            'https://user:pw@fcm.googleapis.com/x',             // credentials
            'https://fcm.googleapis.com.evil.com/x',            // a look-alike host
            'https://evilfcm.googleapis.com.attacker.net/x',
            'https://notfcm.googleapis.co/x',
            'not a url',
        ] as $url) {
            $this->assertFalse(PushEndpoint::isAllowed($url), $url);
        }
    }
}
