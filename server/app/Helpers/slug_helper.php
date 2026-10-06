<?php

/**
 * Generates an SEO-friendly, URL-safe slug from a place title.
 *
 * Cyrillic (Russian) text is transliterated via a fixed BGN-like map that is
 * the single source of truth for Russian — it is applied the same way on
 * every environment, so URLs never change depending on whether the intl
 * extension happens to be installed (intl's own "Russian-Latin/BGN"
 * transliterator can disagree with this map on punctuation/diacritics,
 * which would otherwise make the same title produce two different slugs).
 *
 * When the intl extension's Transliterator class is available, it is used
 * only as a secondary pass to Latinise any characters that are not Cyrillic
 * and not already ASCII (e.g. other scripts); Russian text never reaches
 * this step because the map above already converted it.
 *
 * Non [a-z0-9] characters become a single dash, runs of dashes collapse to
 * one, and the result is trimmed and cut to roughly 80 characters on a word
 * boundary. An input that transliterates to nothing (e.g. emoji-only, or
 * null/empty) returns null.
 *
 * @param string|null $title
 * @return string|null
 */
function generatePlaceSlug(?string $title): ?string
{
    if ($title === null || trim($title) === '') {
        return null;
    }

    static $cyrillicMap = [
        'а' => 'a',  'б' => 'b',  'в' => 'v',  'г' => 'g',   'д' => 'd',
        'е' => 'e',  'ё' => 'e',  'ж' => 'zh', 'з' => 'z',   'и' => 'i',
        'й' => 'y',  'к' => 'k',  'л' => 'l',  'м' => 'm',   'н' => 'n',
        'о' => 'o',  'п' => 'p',  'р' => 'r',  'с' => 's',   'т' => 't',
        'у' => 'u',  'ф' => 'f',  'х' => 'kh', 'ц' => 'ts',  'ч' => 'ch',
        'ш' => 'sh', 'щ' => 'shch', 'ъ' => '', 'ы' => 'y',   'ь' => '',
        'э' => 'e',  'ю' => 'yu', 'я' => 'ya',
    ];

    $lower  = mb_strtolower($title, 'UTF-8');
    $length = mb_strlen($lower, 'UTF-8');
    $transliterated = '';

    for ($i = 0; $i < $length; $i++) {
        $char = mb_substr($lower, $i, 1, 'UTF-8');
        $transliterated .= $cyrillicMap[$char] ?? $char;
    }

    // Secondary pass for any remaining non-ASCII characters (other scripts).
    // The Cyrillic map above already normalised Russian text, so this never
    // runs on it and can't make the output diverge between environments.
    if (class_exists('Transliterator') && preg_match('/[^\x00-\x7F]/', $transliterated)) {
        $transliterator = Transliterator::create('Any-Latin; Latin-ASCII; Lower()');

        if ($transliterator !== null) {
            $result = $transliterator->transliterate($transliterated);

            if ($result !== false) {
                $transliterated = $result;
            }
        }
    }

    $slug = mb_strtolower($transliterated, 'UTF-8');
    $slug = preg_replace('/[^a-z0-9]+/u', '-', $slug);
    $slug = trim($slug, '-');
    $slug = preg_replace('/-+/', '-', $slug);

    if ($slug === '') {
        return null;
    }

    if (mb_strlen($slug, 'UTF-8') > 80) {
        $slug = mb_substr($slug, 0, 80, 'UTF-8');

        // Cut on a word boundary instead of slicing a word in half.
        $lastDash = mb_strrpos($slug, '-', 0, 'UTF-8');

        if ($lastDash !== false) {
            $slug = mb_substr($slug, 0, $lastDash, 'UTF-8');
        }

        $slug = trim($slug, '-');
    }

    return $slug === '' ? null : $slug;
}

/**
 * Builds the path segment used for SEO-friendly place links: "{id}-{slug}"
 * when a slug is available, otherwise just "{id}".
 *
 * Used by server-built links (digest emails, notification emails) so the
 * same id-slug pairing rule is applied everywhere.
 *
 * @param string      $id
 * @param string|null $slug
 * @return string
 */
function placeSlugPath(string $id, ?string $slug): string
{
    return $slug ? $id . '-' . $slug : $id;
}
