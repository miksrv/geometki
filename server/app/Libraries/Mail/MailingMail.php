<?php

namespace App\Libraries\Mail;

/**
 * The letter of a mailing. The queue renders it when it sends it (a queued row keeps only the
 * mailing's id); the preview and the test letter of the admin use the same function, so what the
 * administrator sees is what the recipient gets.
 *
 * A mailing is written in Russian only (the audience is Russian-speaking): every recipient gets
 * the Russian letter, with Russian links, whatever their locale.
 */
class MailingMail
{
    public const LOCALE = 'ru';

    /**
     * @param array<string, mixed> $mailing        A `mailings` row (or the unsaved form with the same keys)
     * @param string|null          $unsubscribeUrl The unsubscribe page of the recipient
     *
     * @return array{subject: string, html: string, text: string}
     */
    public static function render(array $mailing, ?string $unsubscribeUrl): array
    {
        $locale  = self::LOCALE;
        $subject = trim((string) ($mailing['subject'] ?? ''));

        $buttonUrl   = trim((string) ($mailing['button_url'] ?? ''));
        $buttonLabel = trim((string) ($mailing['button_label'] ?? ''));
        $buttonHref  = $buttonUrl !== '' ? MailingContent::resolveUrl($buttonUrl, $locale) : null;

        $body = view('emails/mailing', [
            'locale'      => $locale,
            'subject'     => $subject,
            'imageUrl'    => !empty($mailing['image']) ? MailUrls::upload((string) $mailing['image']) : null,
            'contentHtml' => MailingContent::toHtml((string) ($mailing['content'] ?? ''), $locale),
            'buttonText'  => $buttonHref !== null && $buttonLabel !== '' ? $buttonLabel : null,
            'buttonUrl'   => $buttonHref,
        ], ['saveData' => false]);

        // The first line of the text doubles as the inbox preview
        $preheader = strtok(MailRenderer::toText($body), "\n") ?: $subject;
        $result    = (new MailRenderer())->render($locale, $subject, $body, $preheader, $unsubscribeUrl);

        return ['subject' => $subject, 'html' => $result['html'], 'text' => $result['text']];
    }
}
