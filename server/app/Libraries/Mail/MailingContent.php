<?php

namespace App\Libraries\Mail;

/**
 * The text of a mailing: plain text with a small markup, turned into the HTML of an email. No
 * HTML of the administrator ever reaches the letter: everything is escaped first.
 *
 * - a blank line separates paragraphs, a single line break is `<br>`;
 * - `**bold**`;
 * - `[text](url)`: the url is `http(s)://…` or a site path starting with `/` (made absolute for
 *   the letter's language: `/game` is `/en/game` in English); any other link stays plain text;
 * - lines starting with `- ` make a bulleted list.
 */
class MailingContent
{
    private const P_STYLE    = 'margin:0 0 16px;';
    private const UL_STYLE   = 'margin:0 0 16px;padding-left:22px;';
    private const LI_STYLE   = 'margin:0 0 4px;';
    private const LINK_STYLE = 'color:#2a73c7;text-decoration:underline;';

    public static function toHtml(string $text, string $locale): string
    {
        $text   = str_replace(["\r\n", "\r"], "\n", trim($text));
        $blocks = $text === '' ? [] : preg_split('/\n[ \t]*\n+/', $text);
        $html   = '';

        foreach ($blocks as $block) {
            $paragraph = [];
            $items     = [];

            foreach (explode("\n", $block) as $line) {
                if (preg_match('/^\s*-\s+(.*)$/', $line, $match)) {
                    $html .= self::paragraph($paragraph, $locale);
                    $paragraph = [];
                    $items[]   = $match[1];
                    continue;
                }

                $html .= self::list($items, $locale);
                $items = [];

                if (trim($line) !== '') {
                    $paragraph[] = trim($line);
                }
            }

            $html .= self::paragraph($paragraph, $locale) . self::list($items, $locale);
        }

        return $html;
    }

    /**
     * Whether a url may be a link of a mailing: `http(s)://host…` or a site path (`/game`, not `//host`).
     */
    public static function isLinkUrl(string $url): bool
    {
        if ($url === '' || preg_match('/[\s"\'<>\\\\]|[\x00-\x1f\x7f]/', $url)) {
            return false;
        }

        if (preg_match('#^https?://#i', $url)) {
            $host = parse_url($url, PHP_URL_HOST);

            return is_string($host) && $host !== '';
        }

        return $url[0] === '/' && !str_starts_with($url, '//');
    }

    /**
     * The absolute address of a link of a mailing for the letter's language, or null for a bad url.
     */
    public static function resolveUrl(string $url, string $locale): ?string
    {
        if (!self::isLinkUrl($url)) {
            return null;
        }

        return $url[0] === '/' ? MailUrls::site($locale, $url) : $url;
    }

    /**
     * @param string[] $lines
     */
    private static function paragraph(array $lines, string $locale): string
    {
        if (!$lines) {
            return '';
        }

        return '<p style="' . self::P_STYLE . '">'
            . implode('<br>', array_map(fn (string $line) => self::inline($line, $locale), $lines))
            . "</p>\n";
    }

    /**
     * @param string[] $items
     */
    private static function list(array $items, string $locale): string
    {
        if (!$items) {
            return '';
        }

        return '<ul style="' . self::UL_STYLE . '">'
            . implode('', array_map(fn (string $item) => '<li style="' . self::LI_STYLE . '">' . self::inline($item, $locale) . '</li>', $items))
            . "</ul>\n";
    }

    /**
     * Links and bold inside one line; everything else is escaped.
     */
    private static function inline(string $line, string $locale): string
    {
        $parts = preg_split('/(\[[^\[\]]+\]\([^()\s]+\))/', $line, -1, PREG_SPLIT_DELIM_CAPTURE);
        $html  = '';

        foreach ($parts as $part) {
            if (preg_match('/^\[([^\[\]]+)\]\(([^()\s]+)\)$/', $part, $match)) {
                $url = self::resolveUrl($match[2], $locale);

                if ($url !== null) {
                    $html .= '<a href="' . self::escape($url) . '" class="gm-link" style="' . self::LINK_STYLE . '">' . self::bold($match[1]) . '</a>';
                    continue;
                }
            }

            $html .= self::bold($part);
        }

        return $html;
    }

    private static function bold(string $text): string
    {
        return preg_replace('/\*\*(?=\S)(.+?)(?<=\S)\*\*/su', '<strong>$1</strong>', self::escape($text));
    }

    private static function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
