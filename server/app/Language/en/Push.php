<?php

/**
 * Texts of push notifications (App\Libraries\Push\PushPayload) and of the push API.
 * `{name}` are placeholders; plural keys hold `one|other` forms.
 */
return [
    'event_comment'  => 'New comment',
    'event_photo'    => 'New photo',
    'event_rating'   => 'New rating',
    'event_edit'     => 'Description edited',
    'event_cover'    => 'New cover',
    'event_bookmark' => 'Bookmarked',
    'event_visit'    => 'Marked as visited',
    'guest'          => 'A guest',
    'ratingValue'    => '{value} out of 5',

    'groupTitle'  => '{events} on your places',
    'eventsCount' => 'new event|new events',
    'morePlaces'  => 'and {places} more',
    'places'      => 'place|places',

    'achievementTitle' => 'New achievement',
    'achievementBody'  => '“{title}” — see it in your profile',
    'levelTitle'       => 'New level: {level}',
    'levelBody'        => 'Well done! See what the new level brings',

    'testTitle' => 'Push notifications are on',
    'testBody'  => 'This is how news about your places on Geometki will arrive',

    // API
    'notConfigured'       => 'Push notifications are not set up on the server',
    'invalidSubscription' => 'Invalid subscription data',
    'noSubscriptions'     => 'This account has no devices with push notifications on',
    'tooManyTests'        => 'Too many test notifications, try again in a minute',
    'testFailed'          => 'Could not send the test notification',
];
