<?php

/**
 * Texts of the emails (App\Libraries\Mail\*, Views/emails/*).
 * `{name}` are placeholders; plural keys hold `one|other` forms.
 */
return [
    // Layout
    'brand'              => 'Geometki',
    'footerReason'       => 'You received this email because you have a Geometki account with email notifications turned on.',
    'footerReasonAuth'   => 'This email was sent because someone asked to sign in to Geometki with this address.',
    'footerSettings'     => 'Notification settings',
    'footerUnsubscribe'  => 'Unsubscribe from these emails',

    // Common
    'greeting'  => 'Hi, {name}!',
    'guest'     => 'A guest',
    'openPlace' => 'Open the place',

    // Activity on the user's places
    'subject_comment'  => 'New comment on “{place}”',
    'subject_photo'    => 'New photo of “{place}”',
    'subject_rating'   => 'New rating for “{place}”',
    'subject_edit'     => '“{place}” was edited',
    'subject_cover'    => 'New cover for “{place}”',
    'subject_bookmark' => '“{place}” was bookmarked',
    'subject_visit'    => '“{place}” was marked as visited',
    'subjectGroup'     => '{events} on your places',

    'headline_comment'  => 'New comment on your place',
    'headline_photo'    => 'New photo of your place',
    'headline_rating'   => 'New rating for your place',
    'headline_edit'     => 'Your place was edited',
    'headline_cover'    => 'Your place has a new cover',
    'headline_bookmark' => 'Your place was bookmarked',
    'headline_visit'    => 'Your place was marked as visited',
    'headlineGroup'     => '{events} on your places',

    'event_comment'  => 'New comment',
    'event_photo'    => 'New photo',
    'event_rating'   => 'New rating',
    'event_edit'     => 'Description edited',
    'event_cover'    => 'New cover',
    'event_bookmark' => 'Bookmarked',
    'event_visit'    => 'Marked as visited',

    'eventsCount'  => 'new event|new events',
    'ratingValue'  => 'Rating: {value} out of 5',
    'editHint'     => 'Check what has changed — edits make the place more useful for other travellers.',
    'groupIntro'   => 'While you were away, this happened on your places:',

    // Weekly digest
    'digestSubject'        => 'Your week on Geometki',
    'digestSubjectViews'   => 'Your places were viewed {views} this week',
    'digestSubjectEvents'  => '{events} on your places this week',
    'digestTimes'          => 'time|times',
    'digestGreeting'       => 'Hi, {name}! Here is what happened on Geometki this week.',
    'digestYourPlaces'     => 'Your places this week',
    'digestMorePlaces'     => 'and {places} more',
    'digestYou'            => 'You this week: {stats}',
    'digestViews'          => 'view|views',
    'digestRatings'        => 'rating|ratings',
    'digestComments'       => 'comment|comments',
    'digestPhotos'         => 'photo|photos',
    'digestEdits'          => 'edit|edits',
    'digestSiteWeek'       => 'The week on Geometki',
    'pulsePlaces'          => 'new place|new places',
    'pulsePhotos'          => 'photo|photos',
    'pulseComments'        => 'review|reviews',
    'pulseRatings'         => 'rating|ratings',
    'pulseCollections'     => 'collection|collections',
    'pulseEdits'           => 'edit|edits',
    'digestAuthors'        => 'person did this|people did this',
    'digestHighlights'     => 'Highlights of the week',
    'storyPlace'           => 'New place',
    'storyPhotos'          => 'new photo|new photos',
    'storyCollection'      => 'Collection',
    'storyComment'         => 'Review',
    'storyAchievement'     => 'Achievement',
    'storyLevel'           => 'New level',
    'storyLevelTitle'      => 'Level {level}',
    'collectionPlaces'     => 'place|places',
    'digestOpenFeed'       => 'Open the feed',

    // Sign-in link
    'magicLinkSubject' => 'Your Geometki sign-in link',
    'magicLinkTitle'   => 'Sign in to Geometki',
    'magicLinkIntro'   => 'Click the button below to sign in.',
    'magicLinkButton'  => 'Sign in',
    'magicLinkExpiry'  => 'The link is valid for 5 minutes and works once.',
    'magicLinkIgnore'  => 'If you did not ask to sign in, just ignore this email — nothing happens unless the link is opened.',
    'magicLinkFallback' => 'If the button does not work, copy this link into your browser:',
];
