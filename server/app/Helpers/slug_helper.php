<?php

/**
 * The one fixed Cyrillic → Latin transliteration scheme for the whole site
 * (place slugs, collection slugs, and location slugs). This map, and the
 * rules in transliterateToSlug(), must never change after launch: changing
 * either would silently change every previously-issued slug.
 *
 * @return array<string, string>
 */
function slugCyrillicMap(): array
{
    static $map = [
        'а' => 'a',  'б' => 'b',  'в' => 'v',  'г' => 'g',   'д' => 'd',
        'е' => 'e',  'ё' => 'e',  'ж' => 'zh', 'з' => 'z',   'и' => 'i',
        'й' => 'y',  'к' => 'k',  'л' => 'l',  'м' => 'm',   'н' => 'n',
        'о' => 'o',  'п' => 'p',  'р' => 'r',  'с' => 's',   'т' => 't',
        'у' => 'u',  'ф' => 'f',  'х' => 'kh', 'ц' => 'ts',  'ч' => 'ch',
        'ш' => 'sh', 'щ' => 'shch', 'ъ' => '', 'ы' => 'y',   'ь' => '',
        'э' => 'e',  'ю' => 'yu', 'я' => 'ya',
    ];

    return $map;
}

/**
 * Transliterates and slugifies arbitrary text using the fixed scheme above:
 * Cyrillic via slugCyrillicMap(), any other remaining non-ASCII script via
 * the intl extension's Transliterator (when available) as a secondary pass,
 * then lowercased, non [a-z0-9] runs collapsed to a single dash, trimmed,
 * and cut to roughly 80 characters on a word boundary.
 *
 * Low-level building block shared by generatePlaceSlug() and the location
 * slug generator (LocationSlugLibrary) — kept here, in one place, so both
 * are pinned by the same scheme and the same unit tests.
 *
 * @param string|null $text
 * @return string|null null when the input is empty or transliterates to nothing (e.g. emoji-only)
 */
function transliterateToSlug(?string $text): ?string
{
    if ($text === null || trim($text) === '') {
        return null;
    }

    $cyrillicMap = slugCyrillicMap();

    $lower  = mb_strtolower($text, 'UTF-8');
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
 * Generates an SEO-friendly, URL-safe slug from a place title. See
 * transliterateToSlug() for the scheme.
 *
 * @param string|null $title
 * @return string|null
 */
function generatePlaceSlug(?string $title): ?string
{
    return transliterateToSlug($title);
}

/**
 * Strips a single leading settlement-type word from a Russian location
 * title ("село Никольское" → "Никольское"), case-insensitively, so it does
 * not end up in the location's slug (it stays in the H1). Multi-word types
 * ("посёлок городского типа") are matched whole, not word-by-word, so
 * matching them before shorter overlapping ones (e.g. "посёлок") matters —
 * callers should list longer phrases first, as LocationSlugs::$settlementTypeWords does.
 *
 * Only ever removes a prefix: a settlement word appearing elsewhere in the
 * title ("Старое Село") is left alone.
 *
 * @param string   $titleRu
 * @param string[] $settlementTypeWords Case-insensitive, longest-first for multi-word phrases
 * @return string
 */
function stripLeadingSettlementWord(string $titleRu, array $settlementTypeWords): string
{
    $trimmed = trim($titleRu);

    foreach ($settlementTypeWords as $word) {
        $wordLength = mb_strlen($word, 'UTF-8');
        $prefix     = mb_substr($trimmed, 0, $wordLength, 'UTF-8');

        if (mb_strtolower($prefix, 'UTF-8') !== mb_strtolower($word, 'UTF-8')) {
            continue;
        }

        // Require a word boundary right after the match, so a name that merely
        // starts with the same letters ("Городище") is not mistaken for the
        // type word ("город") followed by a name.
        $boundary = mb_substr($trimmed, $wordLength, 1, 'UTF-8');

        if ($boundary !== '' && $boundary !== ' ') {
            continue;
        }

        $rest = trim(mb_substr($trimmed, $wordLength, null, 'UTF-8'));

        if ($rest !== '') {
            return $rest;
        }
    }

    return $trimmed;
}

/**
 * Generates the unqualified ("clean") slug candidate for a location from its
 * Russian title: strips a leading settlement-type word, then transliterates
 * via the same fixed scheme as place slugs. Collision resolution (parent
 * qualification, reserved words, the "most places" / level-priority primary
 * pick) is NOT done here — see App\Libraries\LocationSlugLibrary, which
 * needs the database to check other locations.
 *
 * @param string|null $titleRu
 * @param string[]    $settlementTypeWords From Config\LocationSlugs::$settlementTypeWords
 * @return string|null
 */
function generateLocationBaseSlug(?string $titleRu, array $settlementTypeWords = []): ?string
{
    if ($titleRu === null || trim($titleRu) === '') {
        return null;
    }

    $stripped = $settlementTypeWords ? stripLeadingSettlementWord($titleRu, $settlementTypeWords) : $titleRu;

    return transliterateToSlug($stripped);
}

/**
 * Generates an SEO-friendly slug for a collection title, reusing the same
 * transliteration/formatting rules as place slugs (see generatePlaceSlug()).
 *
 * @param string|null $title
 * @return string|null
 */
function generateCollectionSlug(?string $title): ?string
{
    return generatePlaceSlug($title);
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
