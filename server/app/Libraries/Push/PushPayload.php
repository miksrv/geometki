<?php

namespace App\Libraries\Push;

use App\Libraries\Mail\MailText;
use App\Libraries\Mail\MailUrls;

/**
 * What a push shows: the JSON the service worker (client/public/sw.js) turns into
 * a system notification — {title, body, url, icon, image?, tag, lang}.
 * `tag` makes a newer push about the same thing replace the older one.
 */
class PushPayload
{
    /** Places listed by name in a grouped push */
    private const GROUP_PLACES = 3;

    /**
     * Activity on the user's places: one event, or several grouped.
     *
     * @param array $events ActivityMail::loadEvents() items, non-empty, oldest first
     */
    public static function activity(array $events, string $userId, string $locale): array
    {
        $locale = MailText::locale($locale);

        if (count($events) === 1) {
            $event = $events[0];
            $body  = self::eventLine($event, $locale);

            if ($event['rating']) {
                $body .= ' · ' . MailText::get($locale, 'ratingValue', ['value' => $event['rating']], 'Push');
            }

            if ($event['comment']) {
                $body .= ': «' . mb_strimwidth(trim(preg_replace('/\s+/u', ' ', $event['comment'])), 0, 120, '…') . '»';
            }

            return self::payload($locale, [
                'title' => $event['title'],
                'body'  => $body,
                'url'   => MailUrls::place($locale, $event['placeId'], $event['slug']),
                'image' => $event['hasCover'] ? MailUrls::placeCover($event['placeId']) : null,
                'tag'   => 'place-' . $event['placeId'],
            ]);
        }

        // Several events: one line per place, "Place: comment, rating"
        $places = [];

        foreach ($events as $event) {
            $places[$event['placeId']]['title']    = $event['title'];
            $places[$event['placeId']]['slug']     = $event['slug'];
            $places[$event['placeId']]['events'][] = mb_strtolower(MailText::get($locale, 'event_' . $event['type'], [], 'Push'));
        }

        $lines = [];

        foreach (array_slice($places, 0, self::GROUP_PLACES, true) as $place) {
            $lines[] = $place['title'] . ': ' . implode(', ', array_unique($place['events']));
        }

        if (($more = count($places) - self::GROUP_PLACES) > 0) {
            $lines[] = MailText::get($locale, 'morePlaces', ['places' => MailText::plural($locale, 'places', $more, 'Push')], 'Push');
        }

        $single = count($places) === 1 ? array_key_first($places) : null;

        return self::payload($locale, [
            'title' => MailText::get($locale, 'groupTitle', ['events' => MailText::plural($locale, 'eventsCount', count($events), 'Push')], 'Push'),
            'body'  => implode("\n", $lines),
            'url'   => $single !== null
                ? MailUrls::place($locale, $single, $places[$single]['slug'])
                : MailUrls::user($locale, $userId, 'places'),
            'tag'   => 'places',
        ]);
    }

    /**
     * @param array $meta The in-app notification's meta: title_ru, title_en, image
     */
    public static function achievement(array $meta, string $userId, string $locale): array
    {
        $locale = MailText::locale($locale);
        $title  = $meta['title_' . $locale] ?? $meta['title_ru'] ?? '';

        return self::payload($locale, [
            'title' => MailText::get($locale, 'achievementTitle', [], 'Push'),
            'body'  => MailText::get($locale, 'achievementBody', ['title' => $title], 'Push'),
            'url'   => MailUrls::user($locale, $userId, 'achievements'),
            'icon'  => !empty($meta['image']) ? MailUrls::upload($meta['image']) : null,
            // Two achievements at once are two notifications, not one replacing the other
            'tag'   => 'achievement-' . substr(md5($title), 0, 8),
        ]);
    }

    /**
     * @param array $meta The in-app notification's meta: level
     */
    public static function level(array $meta, string $userId, string $locale): array
    {
        $locale = MailText::locale($locale);

        return self::payload($locale, [
            'title' => MailText::get($locale, 'levelTitle', ['level' => (int) ($meta['level'] ?? 0)], 'Push'),
            'body'  => MailText::get($locale, 'levelBody', [], 'Push'),
            'url'   => MailUrls::user($locale, $userId),
            'tag'   => 'level',
        ]);
    }

    public static function test(string $locale): array
    {
        $locale = MailText::locale($locale);

        return self::payload($locale, [
            'title' => MailText::get($locale, 'testTitle', [], 'Push'),
            'body'  => MailText::get($locale, 'testBody', [], 'Push'),
            'url'   => MailUrls::settings($locale),
            'tag'   => 'test',
        ]);
    }

    /**
     * "New comment · traveler42"
     */
    private static function eventLine(array $event, string $locale): string
    {
        return MailText::get($locale, 'event_' . $event['type'], [], 'Push')
            . ' · ' . ($event['actor'] ?: MailText::get($locale, 'guest', [], 'Push'));
    }

    private static function payload(string $locale, array $fields): array
    {
        return array_filter([
            'title' => $fields['title'],
            'body'  => $fields['body'] ?? '',
            'url'   => $fields['url'],
            'icon'  => $fields['icon'] ?? MailUrls::siteRoot() . '/android-chrome-192x192.png',
            'image' => $fields['image'] ?? null,
            'tag'   => $fields['tag'],
            'lang'  => $locale,
        ], static fn ($value) => $value !== null);
    }
}
