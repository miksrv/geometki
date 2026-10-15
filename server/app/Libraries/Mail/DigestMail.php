<?php

namespace App\Libraries\Mail;

/**
 * The weekly digest. `digest:weekly` renders the body (it needs the week's
 * data) and queues it; the queue wraps it in the layout when sending.
 */
class DigestMail
{
    /** The user's places listed in full; the rest are counted in one line */
    public const YOUR_PLACES = 5;

    /** Pulse numbers in the order the home page shows them: [field, plural forms key] */
    public const PULSE_STATS = [
        ['places', 'pulsePlaces'],
        ['photos', 'pulsePhotos'],
        ['comments', 'pulseComments'],
        ['ratings', 'pulseRatings'],
        ['collections', 'pulseCollections'],
        ['edits', 'pulseEdits'],
    ];

    /**
     * The subject tells the most personal news: how often the user's places were
     * viewed, else how much happened on them, else the plain "Your week".
     */
    public static function subject(string $locale, array $sections = []): string
    {
        $places = $sections['place_activity'] ?? [];
        $views  = array_sum(array_map(static fn (array $place) => (int) ($place['views'] ?? 0), $places));
        $events = array_sum(array_map(
            static fn (array $place) => (int) ($place['ratings'] ?? 0) + (int) ($place['comments'] ?? 0) + (int) ($place['photos'] ?? 0) + (int) ($place['edits'] ?? 0),
            $places
        ));

        if ($views > 0) {
            return MailText::get($locale, 'digestSubjectViews', ['views' => MailText::plural($locale, 'digestTimes', $views)]);
        }

        if ($events > 0) {
            return MailText::get($locale, 'digestSubjectEvents', ['events' => MailText::plural($locale, 'eventsCount', $events)]);
        }

        return MailText::get($locale, 'digestSubject');
    }

    public static function body(string $userName, array $sections, string $locale): string
    {
        $locale = MailText::locale($locale);

        return view('emails/digest', [
            'locale'     => $locale,
            'userName'   => $userName,
            'sections'   => $sections,
            'highlights' => array_values(array_filter(array_map(
                static fn (array $story) => self::highlight($story, $locale),
                $sections['site']['highlights'] ?? []
            ))),
        ], ['saveData' => false]);
    }

    /**
     * A feed story (FeedPresenter) as one line of "Highlights of the week":
     * what it is about, where it links, its picture and who did it.
     *
     * @return array{title: string, url: string, image: ?string, square: bool, label: string, author: string, quote: ?string}|null
     */
    public static function highlight(array $story, string $locale): ?array
    {
        $author = $story['author']['name'] ?? '';
        $place  = $story['place'] ?? null;
        $cover  = $place['cover']['preview'] ?? null;

        $item = match ($story['type']) {
            'place' => $place ? [
                'title' => $place['title'],
                'url'   => MailUrls::place($locale, $place['id'], $place['slug'] ?? null),
                'image' => $cover,
                'label' => MailText::get($locale, 'storyPlace'),
            ] : null,
            'photo' => $place ? [
                'title' => $place['title'],
                'url'   => MailUrls::place($locale, $place['id'], $place['slug'] ?? null),
                'image' => self::mailImage($story['photos'][0]['preview'] ?? null) ?? $cover,
                'label' => MailText::plural($locale, 'storyPhotos', (int) ($story['photosCount'] ?? count($story['photos'] ?? []))),
            ] : null,
            'comment' => $place ? [
                'title' => $place['title'],
                'url'   => MailUrls::place($locale, $place['id'], $place['slug'] ?? null),
                'image' => $cover,
                'label' => MailText::get($locale, 'storyComment'),
                'quote' => isset($story['comment']['content']) ? mb_strimwidth(trim(strip_tags($story['comment']['content'])), 0, 160, '…') : null,
            ] : null,
            'collection' => isset($story['collection']) ? [
                'title' => $story['collection']['title'],
                'url'   => MailUrls::collection($locale, $story['collection']['id'], $story['collection']['slug'] ?? null),
                'image' => $story['collection']['covers'][0]['preview'] ?? null,
                'label' => MailText::get($locale, 'storyCollection') . ' · '
                    . MailText::plural($locale, 'collectionPlaces', (int) ($story['collection']['placesCount'] ?? 0)),
            ] : null,
            'achievement' => isset($story['achievement'], $story['author']) ? [
                'title' => $story['achievement']['title'],
                'url'   => MailUrls::user($locale, $story['author']['id'], 'achievements'),
                'image'  => $story['achievement']['image'] ?? null,
                'square' => true,
                'label'  => MailText::get($locale, 'storyAchievement'),
            ] : null,
            'level' => isset($story['level'], $story['author']) ? [
                'title' => MailText::get($locale, 'storyLevelTitle', ['level' => (int) $story['level']]),
                'url'   => MailUrls::user($locale, $story['author']['id']),
                'image'  => $story['author']['avatar'] ?? null,
                'square' => true,
                'label'  => MailText::get($locale, 'storyLevel'),
            ] : null,
            default => null,
        };

        if ($item === null) {
            return null;
        }

        return [
            'title'  => (string) $item['title'],
            'url'    => $item['url'],
            'image'  => !empty($item['image']) ? MailUrls::upload($item['image']) : null,
            'square' => $item['square'] ?? false,
            'label'  => $item['label'],
            'author' => $author,
            'quote'  => $item['quote'] ?? null,
        ];
    }

    /**
     * @return array{html: string, text: string}
     */
    public static function render(string $body, string $subject, string $locale, ?string $unsubscribePage): array
    {
        // The greeting line doubles as the inbox preview
        $preheader = strtok(MailRenderer::toText($body), "\n") ?: $subject;

        return (new MailRenderer())->render($locale, $subject, $body, $preheader, $unsubscribePage);
    }

    /**
     * WebP is not shown by Outlook and older clients: such a picture is skipped
     * in favour of the place cover (always JPEG).
     */
    private static function mailImage(?string $path): ?string
    {
        return $path && !preg_match('/\.webp$/i', $path) ? $path : null;
    }
}
