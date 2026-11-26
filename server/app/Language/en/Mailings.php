<?php

return [
    'notFound'          => 'Mailing not found',
    'badBody'           => 'The request body must be a JSON object',
    'badField'          => 'The value must be a string',
    'subjectRequired'   => 'Give the mailing a subject',
    'subjectLong'       => 'The subject is at most {0, number} characters long',
    'contentRequired'   => 'Write the text of the mailing',
    'contentLong'       => 'The text is at most {0, number} characters long',
    'labelRequired'     => 'Give the button a label',
    'labelLong'         => 'The label is at most {0, number} characters long',
    'urlInvalid'        => 'The link: a site path starting with / or an address starting with http:// or https://',
    'urlLong'           => 'The link is at most {0, number} characters long',
    'notDraft'          => 'Only a draft can be changed or sent',
    'alreadyCompleted'  => 'The mailing is completed already',
    'badImage'          => 'The picture: JPEG or PNG up to 2 MB',
    'imageError'        => 'The picture could not be saved, please try again',
    'noRecipients'      => 'Nobody would get this mailing: there are no recipients',
    'sendFailed'        => 'The mailing could not be sent, please try again',
    'noEmail'           => 'Your account has no email address to send the test to',
    'tooManyTests'      => 'Too many test letters: wait a minute',
    'testFailed'        => 'The test letter could not be sent, check the mail settings',
];
