<?php

namespace App\Libraries\Mail;

/**
 * Every kind of email filled with sample data, for `email:preview` and
 * `system:test-email`. Uses no database.
 */
class MailSamples
{
    public const KINDS = ['magic-link', 'activity', 'activity-group', 'digest', 'digest-site'];

    public static function build(string $kind, string $to, string $locale): EmailMessage
    {
        $locale      = MailText::locale($locale);
        $token       = 'sample.comment.sample-signature';
        $unsubscribe = MailUrls::unsubscribePage($locale, $token);
        $oneClick    = MailUrls::oneClickUnsubscribe($token);
        $name        = $locale === 'en' ? 'Traveller' : 'Путешественник';

        switch ($kind) {
            case 'magic-link':
                return MagicLinkMail::build($to, MailUrls::site($locale, '/auth?token=sample-token'), $locale);

            case 'activity':
            case 'activity-group':
                $events = $kind === 'activity'
                    ? [self::event('comment', 'Водопад Гадельша', 'Были здесь в мае — воды очень много, тропа местами размыта.')]
                    : [
                        self::event('comment', 'Водопад Гадельша', 'Отличное место, спасибо за точку!'),
                        self::event('rating', 'Водопад Гадельша', null, 5),
                        self::event('photo', 'Пещера Сумган-Кутук'),
                        self::event('visit', 'Пещера Сумган-Кутук', null, null, null),
                    ];
                $result = ActivityMail::render($events, $name, $locale, $unsubscribe);

                return new EmailMessage($to, $result['subject'], $result['html'], $result['text'], $oneClick, 'activity');

            case 'digest':
            case 'digest-site':
                // An author with news of their places, or someone without any: the popular places instead
                $personal = $kind === 'digest' ? [
                    'week_summary'   => ['places_created' => 2, 'photos_uploaded' => 11, 'ratings_given' => 3, 'edits_made' => 0],
                    'place_activity' => [
                        ['place_id' => 'sample1', 'slug' => 'vodopad-gadelsha', 'title' => 'Водопад Гадельша', 'cover' => null, 'views' => 154, 'ratings' => 2, 'comments' => 1, 'photos' => 0, 'edits' => 1],
                        ['place_id' => 'sample2', 'slug' => null, 'title' => 'Пещера Сумган-Кутук', 'cover' => null, 'views' => 21, 'ratings' => 0, 'comments' => 0, 'photos' => 4, 'edits' => 0],
                    ],
                ] : [
                    'top_places' => [
                        ['place_id' => 'sample3', 'slug' => 'gora-polkovnik', 'title' => 'Гора Полковник', 'cover' => null, 'views' => 412],
                        ['place_id' => 'sample1', 'slug' => 'vodopad-gadelsha', 'title' => 'Водопад Гадельша', 'cover' => null, 'views' => 154],
                        ['place_id' => 'sample2', 'slug' => null, 'title' => 'Пещера Сумган-Кутук', 'cover' => null, 'views' => 96],
                    ],
                ];
                $sections = $personal + [
                    'site' => [
                        'pulse' => [
                            'places' => 5, 'photos' => 48, 'comments' => 7, 'ratings' => 23, 'edits' => 141, 'visits' => 3,
                            'collections' => 2, 'total' => 229, 'authors' => 14,
                            'users' => [
                                ['id' => 'u1', 'name' => 'traveler42', 'avatar' => null, 'count' => 64],
                                ['id' => 'u2', 'name' => 'Nika', 'avatar' => null, 'count' => 31],
                            ],
                        ],
                        'highlights' => [
                            ['type' => 'place', 'weight' => 3, 'author' => ['id' => 'u1', 'name' => 'traveler42'],
                                'place' => ['id' => 'p1', 'slug' => 'gora-polkovnik', 'title' => 'Гора Полковник', 'cover' => null]],
                            ['type' => 'collection', 'weight' => 3, 'author' => ['id' => 'u2', 'name' => 'Nika'],
                                'collection' => ['id' => 'c1', 'slug' => 'bunkery', 'title' => 'Секретные объекты СССР', 'placesCount' => 6, 'covers' => []]],
                            ['type' => 'comment', 'weight' => 2, 'author' => ['id' => 'u2', 'name' => 'Nika'],
                                'place' => ['id' => 'p2', 'slug' => null, 'title' => 'Сайгачий рудник', 'cover' => null],
                                'comment' => ['id' => 'm1', 'content' => 'Дорога разбита, но доехать можно на любой машине.']],
                            ['type' => 'achievement', 'weight' => 2, 'author' => ['id' => 'u1', 'name' => 'traveler42'],
                                'achievement' => ['id' => 'a1', 'title' => 'Серия', 'image' => null, 'tier' => 'bronze']],
                        ],
                    ],
                ];
                $body    = DigestMail::body($name, $sections, $locale);
                $subject = DigestMail::subject($locale, $sections);
                $result  = DigestMail::render($body, $subject, $locale, $unsubscribe);

                return new EmailMessage($to, $subject, $result['html'], $result['text'], $oneClick, 'digest');
        }

        throw new \InvalidArgumentException('Unknown email kind: ' . $kind . ' (one of ' . implode(', ', self::KINDS) . ')');
    }

    private static function event(string $type, string $title, ?string $comment = null, ?int $rating = null, ?string $actor = 'traveler42'): array
    {
        return [
            'activityId' => 'sample-' . $type,
            'type'       => $type,
            'placeId'    => 'sample-' . md5($title),
            'slug'       => null,
            'title'      => $title,
            'hasCover'   => false,
            'actorId'    => $actor !== null ? 'sample-' . $actor : null,
            'actor'      => $actor,
            'comment'    => $comment,
            'rating'     => $rating,
        ];
    }
}
