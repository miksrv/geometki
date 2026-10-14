<?php

namespace App\Libraries\Mail;

/**
 * Wraps an email body in Views/emails/layout and derives the plain-text part.
 */
class MailRenderer
{
    /**
     * @param string      $locale
     * @param string      $subject
     * @param string      $content         Body HTML
     * @param string      $preheader       Inbox preview text
     * @param string|null $unsubscribeUrl  Unsubscribe page; null for transactional mail
     * @param bool        $transactional   Sign-in and similar mail: no settings link, another footer reason
     *
     * @return array{html: string, text: string}
     */
    public function render(
        string $locale,
        string $subject,
        string $content,
        string $preheader = '',
        ?string $unsubscribeUrl = null,
        bool $transactional = false,
    ): array {
        $locale = MailText::locale($locale);

        $html = view('emails/layout', [
            'locale'         => $locale,
            'subject'        => $subject,
            'preheader'      => $preheader,
            'content'        => $content,
            'footerReason'   => MailText::get($locale, $transactional ? 'footerReasonAuth' : 'footerReason'),
            'settingsUrl'    => $transactional ? null : MailUrls::settings($locale),
            'unsubscribeUrl' => $unsubscribeUrl,
            'siteUrl'        => MailUrls::site($locale),
            'logoUrl'        => MailUrls::logo(),
        ], ['saveData' => false]);

        return ['html' => $html, 'text' => self::toText($html)];
    }

    /**
     * A readable plain-text version of an email: links become "text (url)",
     * blocks become paragraphs, the preheader and styles are dropped.
     */
    public static function toText(string $html): string
    {
        $html = preg_replace('#<(head|style|script)\b.*?</\1>#si', '', $html);
        $html = preg_replace('#<div class="gm-preheader".*?</div>#si', '', $html);
        $html = preg_replace('#<!--.*?-->#s', '', $html);

        // Source line breaks mean nothing in HTML: lines come only from the tags below
        $html = preg_replace('/\s+/u', ' ', $html);

        // Links: "text (url)", or just the url when the text is the url
        $html = preg_replace_callback('#<a\b[^>]*href=(["\'])(.*?)\1[^>]*>(.*?)</a>#si', static function (array $m): string {
            $url  = html_entity_decode($m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $text = trim(preg_replace('/\s+/u', ' ', strip_tags($m[3])));

            // A picture link (a thumbnail, an avatar) repeats a text link next to it
            if ($text === '') {
                return '';
            }

            if ($text === $url) {
                return $url;
            }

            return $text . ' (' . $url . ')';
        }, $html);

        $html = preg_replace('#<br\s*/?>#i', "\n", $html);
        $html = preg_replace('#<hr\b[^>]*>#i', "\n\n----\n\n", $html);
        $html = preg_replace('#</(p|h[1-6]|table|ul|ol)>#i', "\n\n", $html);
        $html = preg_replace('#</(tr|li|div)>#i', "\n", $html);
        $html = preg_replace('#</td>#i', ' ', $html);

        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace(["\u{034F}", "\u{200C}", "\u{00A0}"], ['', '', ' '], $text);

        // Trim every line, collapse runs of spaces and of blank lines
        $lines = array_map(static fn (string $line): string => trim(preg_replace('/[ \t]+/u', ' ', $line)), explode("\n", $text));
        $text  = preg_replace("/\n{3,}/", "\n\n", implode("\n", $lines));

        return trim($text) . "\n";
    }
}
