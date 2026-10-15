<?php

namespace App\Libraries\Mail;

use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use Config\Database;

/**
 * The email about activity on a user's places: one event in detail, or
 * several events (queued while the previous email's interval ran) grouped
 * by place.
 */
class ActivityMail
{
    /**
     * Load what the email shows about the given activity rows. Rows whose
     * activity or place is gone are left out.
     *
     * @param string[] $activityIds
     *
     * @return array<int, array{activityId: string, type: string, placeId: string, slug: ?string, title: string, hasCover: bool,
     *     actorId: ?string, actor: ?string, comment: ?string, rating: ?int}>
     */
    public static function loadEvents(array $activityIds, string $locale): array
    {
        if (!$activityIds) {
            return [];
        }

        $rows = Database::connect()->table('activity a')
            ->select('a.id, a.type, a.place_id, a.created_at, a.user_id, u.name AS actor, c.content AS comment, r.value AS rating,
                p.slug, p.photos, p.cover_external_id')
            ->join('places p', 'p.id = a.place_id AND p.deleted_at IS NULL')
            ->join('users u', 'u.id = a.user_id', 'left')
            ->join('comments c', 'c.id = a.comment_id AND c.deleted_at IS NULL', 'left')
            ->join('rating r', 'r.id = a.rating_id', 'left')
            ->whereIn('a.id', $activityIds)
            ->where('a.deleted_at', null)
            ->orderBy('a.created_at', 'ASC')
            ->get()
            ->getResult();

        if (!$rows) {
            return [];
        }

        $content = (new PlacesContent())->forLocale($locale);
        $content->translate(array_column($rows, 'place_id'));
        $covers = new PlaceFormatterLibrary();

        return array_map(static fn (object $row): array => [
            'activityId' => $row->id,
            'type'     => $row->type,
            'placeId'  => $row->place_id,
            'slug'     => $row->slug,
            'title'    => $content->title($row->place_id) ?: $row->place_id,
            'hasCover' => $covers->coverExists($row->place_id, (int) $row->photos > 0 || !empty($row->cover_external_id)),
            'actorId'  => $row->user_id,
            'actor'    => $row->actor,
            'comment'  => $row->type === 'comment' ? $row->comment : null,
            'rating'   => $row->type === 'rating' && $row->rating !== null ? (int) $row->rating : null,
        ], $rows);
    }

    /**
     * @param array       $events          From loadEvents(), non-empty
     * @param string      $userName        Recipient's name
     * @param string|null $unsubscribePage Unsubscribe page URL for the footer
     *
     * @return array{subject: string, html: string, text: string}
     */
    public static function render(array $events, string $userName, string $locale, ?string $unsubscribePage = null): array
    {
        $locale = MailText::locale($locale);
        $single = count($events) === 1;
        $places = [];

        foreach ($events as $event) {
            $places[$event['placeId']] ??= [
                'title'  => $event['title'],
                'url'    => MailUrls::place($locale, $event['placeId'], $event['slug']),
                'cover'  => $event['hasCover'] ? MailUrls::placeCover($event['placeId']) : null,
                'events' => [],
            ];

            $actor   = $event['actor'] ?: MailText::get($locale, 'guest');
            $comment = $event['comment'] !== null ? trim($event['comment']) : null;

            // Repeats of one action by one person (several edits in a row) are one line
            // with a count; comments, ratings and guests (no one to tell apart) stay apart
            $actorId = $event['actorId'] ?? null;
            $repeat  = $comment === null && !$event['rating'] && $actorId ? $event['type'] . "\n" . $actorId : null;

            if ($repeat !== null && isset($places[$event['placeId']]['repeats'][$repeat])) {
                $places[$event['placeId']]['events'][$places[$event['placeId']]['repeats'][$repeat]]['count']++;

                continue;
            }

            if ($repeat !== null) {
                $places[$event['placeId']]['repeats'][$repeat] = count($places[$event['placeId']]['events']);
            }

            $places[$event['placeId']]['events'][] = [
                'type'    => $event['type'],
                'actor'   => $actor,
                'comment' => $comment,
                'rating'  => $event['rating'],
                'count'   => 1,
            ];
        }

        $places = array_values(array_map(static function (array $place): array {
            unset($place['repeats']);

            return $place;
        }, $places));

        if ($single) {
            $subject  = MailText::get($locale, 'subject_' . $events[0]['type'], ['place' => $events[0]['title']]);
            $headline = MailText::get($locale, 'headline_' . $events[0]['type']);
        } else {
            $count    = MailText::plural($locale, 'eventsCount', count($events));
            $subject  = MailText::get($locale, 'subjectGroup', ['events' => $count]);
            $headline = MailText::get($locale, 'headlineGroup', ['events' => $count]);
        }

        $content = view('emails/activity', [
            'locale'   => $locale,
            'userName' => $userName,
            'headline' => $headline,
            'places'   => $places,
            'single'   => $single,
        ], ['saveData' => false]);

        $preheader = $single
            ? $places[0]['title'] . ' · ' . MailText::get($locale, 'event_' . $events[0]['type'])
            : implode(', ', array_column($places, 'title'));

        return ['subject' => $subject] + (new MailRenderer())->render($locale, $subject, $content, $preheader, $unsubscribePage);
    }

    /**
     * The unsubscribe scope of an email with these events: their type when
     * they are all of one type, otherwise every activity type.
     */
    public static function unsubscribeType(array $events): string
    {
        $types = array_unique(array_column($events, 'type'));

        return count($types) === 1 ? reset($types) : 'activity';
    }
}
