<?php

namespace App\Libraries\Mail;

/**
 * Email and push texts from Language/{locale}/{Emails,Push}.php, with `{name}` placeholders
 * and plural forms, independent of the request locale and of ext-intl
 * (emails are built in CLI for many recipients with different locales).
 */
class MailText
{
    public const LOCALES = ['ru', 'en'];

    public static function locale(?string $locale): string
    {
        return in_array($locale, self::LOCALES, true) ? $locale : 'ru';
    }

    /**
     * @param array<string, string|int> $params Replaces `{key}` placeholders (values are not escaped)
     * @param string                    $file   The language file: Emails, Push
     */
    public static function get(string $locale, string $key, array $params = [], string $file = 'Emails'): string
    {
        $text = lang($file . '.' . $key, [], self::locale($locale));

        if (!$params) {
            return $text;
        }

        $replace = [];
        foreach ($params as $name => $value) {
            $replace['{' . $name . '}'] = (string) $value;
        }

        return strtr($text, $replace);
    }

    /**
     * "{count} word" with the right plural form. The language string holds the
     * forms separated by `|`: ru `one|few|many` ("оценка|оценки|оценок"),
     * en `one|other`.
     */
    public static function plural(string $locale, string $key, int $count, string $file = 'Emails'): string
    {
        return $count . ' ' . self::pluralForm($locale, $key, $count, $file);
    }

    /**
     * Only the word of plural(): ('ru', 'digestRatings', 3) → "оценки".
     */
    public static function pluralForm(string $locale, string $key, int $count, string $file = 'Emails'): string
    {
        $forms = explode('|', self::get($locale, $key, [], $file));

        return $forms[self::pluralIndex(self::locale($locale), $count, count($forms))];
    }

    public static function pluralIndex(string $locale, int $count, int $formsCount = 3): int
    {
        $count = abs($count);

        if ($locale === 'ru' && $formsCount >= 3) {
            $mod10  = $count % 10;
            $mod100 = $count % 100;

            if ($mod10 === 1 && $mod100 !== 11) {
                return 0;
            }

            if ($mod10 >= 2 && $mod10 <= 4 && ($mod100 < 12 || $mod100 > 14)) {
                return 1;
            }

            return 2;
        }

        return $count === 1 ? 0 : min(1, $formsCount - 1);
    }
}
