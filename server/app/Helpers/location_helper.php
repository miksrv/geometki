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
