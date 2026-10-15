<?php

namespace App\Libraries\Mail;

/**
 * The passwordless sign-in email. Transactional: sent at once, not queued
 * (the link lives 5 minutes, and the token must not be stored), no
 * unsubscribe link.
 */
class MagicLinkMail
{
    public static function build(string $email, string $link, string $locale): EmailMessage
    {
        $locale  = MailText::locale($locale);
        $subject = MailText::get($locale, 'magicLinkSubject');
        $content = view('emails/magic_link', ['locale' => $locale, 'link' => $link], ['saveData' => false]);
        $result  = (new MailRenderer())->render($locale, $subject, $content, MailText::get($locale, 'magicLinkIntro'), null, true);

        return new EmailMessage($email, $subject, $result['html'], $result['text'], null, 'auth');
    }
}
