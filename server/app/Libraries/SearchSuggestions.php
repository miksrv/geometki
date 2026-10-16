<?php

namespace App\Libraries;

/**
 * The pure parts of `GET /search/suggest`: which of the site's own locations (countries,
 * regions, districts, localities with places) go first and the caption of an address.
 *
 * Pure: no database, the controller loads the rows.
 */
class SearchSuggestions
{
    /**
     * Locations whose name starts with the query first, then the fullest; a locality before a
     * district and a region of the same name and count (the narrowest answer to a city name).
     *
     * @param array<int, array{type: string, title: string, placesCount: int}> $areas
     * @return array<int, array<string, mixed>>
     */
    public static function rankAreas(array $areas, string $query, int $limit): array
    {
        $query = mb_strtolower(trim($query));
        $depth = ['locality' => 0, 'district' => 1, 'region' => 2, 'country' => 3];

        usort($areas, static function (array $a, array $b) use ($query, $depth): int {
            $aPrefix = str_starts_with(mb_strtolower($a['title']), $query) ? 0 : 1;
            $bPrefix = str_starts_with(mb_strtolower($b['title']), $query) ? 0 : 1;

            return [$aPrefix, -$a['placesCount'], $depth[$a['type']] ?? 9]
                <=> [$bPrefix, -$b['placesCount'], $depth[$b['type']] ?? 9];
        });

        return array_slice($areas, 0, $limit);
    }

    /**
     * "Region, Country" under an address: its parts without empty ones, repeats and the title.
     *
     * @param array<int, string|null> $parts
     */
    public static function caption(string $title, array $parts): ?string
    {
        $seen   = [mb_strtolower($title)];
        $result = [];

        foreach ($parts as $part) {
            $part = trim((string) $part);

            if ($part === '' || in_array(mb_strtolower($part), $seen, true)) {
                continue;
            }

            $seen[]   = mb_strtolower($part);
            $result[] = $part;
        }

        return $result ? implode(', ', $result) : null;
    }
}
