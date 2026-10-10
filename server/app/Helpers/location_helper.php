<?php

/**
 * Normalizes a location name for alias matching: lowercase, ё→е, trimmed,
 * internal whitespace collapsed to a single space. Two names that normalize
 * the same are treated as the same place name by the geocoder's alias
 * matching step (App\Libraries\LocationMatcher) and by
 * App\Libraries\LocationSlugLibrary's collision grouping.
 *
 * Deliberately does not strip punctuation or transliterate: an alias is
 * matched against names coming from the same source family (Nominatim
 * namedetails, or the titles already stored on a location), which use
 * consistent punctuation within themselves, and stripping it risks merging
 * genuinely different names ("Пушкино" vs "Пушкино-2").
 *
 * @param string|null $name
 * @return string empty string for null/blank input
 */
function normalizeLocationName(?string $name): string
{
    if ($name === null) {
        return '';
    }

    $normalized = mb_strtolower(trim($name), 'UTF-8');
    $normalized = str_replace('ё', 'е', $normalized);
    $normalized = preg_replace('/\s+/u', ' ', $normalized);

    return $normalized ?? '';
}

/**
 * Whether a name coming from the geocoder is usable as a location name:
 * it must contain at least one letter. Nominatim occasionally labels a
 * garden partnership or a numbered plot as a village/hamlet ("№ 20"), and
 * such a string must never become a locality row (or its slug).
 *
 * @param string|null $name
 * @return bool
 */
function isUsableLocationName(?string $name): bool
{
    return $name !== null && preg_match('/\p{L}/u', $name) === 1;
}

/**
 * The English street address line. Nominatim has no English names for most
 * streets, so the lang=en reverse call echoes the Cyrillic one ("улица 9
 * Января, 43") — or, worse, a different nearby road. A Cyrillic English
 * address is replaced by the transliterated Russian one ("ulitsa 9 Yanvarya,
 * 43"), which is what the previous provider returned; a Latin one is kept.
 *
 * @param string $addressEn
 * @param string $addressRu
 * @return string
 */
function latinizeStreetAddress(string $addressEn, string $addressRu): string
{
    if (!preg_match('/\p{Cyrillic}/u', $addressEn)) {
        return $addressEn;
    }

    return transliterateLocationTitle($addressRu !== '' ? $addressRu : $addressEn);
}

/**
 * Transliterates a Cyrillic location title into a Latin one for title_en,
 * keeping capitalization ("Аргаяшский муниципальный округ" →
 * "Argayashskiy munitsipalnyy okrug"). Used as the title_en fallback when
 * the geocoder has no English name for a new location — a Latin
 * transliteration is at least readable in the English UI, whereas the raw
 * Cyrillic string the provider returns is not. Uses the site's one fixed
 * transliteration scheme (slugCyrillicMap()) so the result agrees with the
 * location's slug.
 *
 * @param string $title
 * @return string
 */
function transliterateLocationTitle(string $title): string
{
    helper('slug');

    $map    = slugCyrillicMap();
    $length = mb_strlen($title, 'UTF-8');
    $result = '';

    for ($i = 0; $i < $length; $i++) {
        $char  = mb_substr($title, $i, 1, 'UTF-8');
        $lower = mb_strtolower($char, 'UTF-8');

        if (!isset($map[$lower])) {
            $result .= $char;
            continue;
        }

        $latin = $map[$lower];
        $result .= $char !== $lower ? mb_convert_case($latin, MB_CASE_TITLE, 'UTF-8') : $latin;
    }

    return $result;
}
