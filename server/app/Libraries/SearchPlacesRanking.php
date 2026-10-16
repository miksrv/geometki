<?php

namespace App\Libraries;

/**
 * The sort of a search before pagination, over light rows of the loaded found places (`id`,
 * `category`, `views`, `rating`, `comments`, `created_at`, `distance`) in the full-text
 * relevance order. The facets and the category filter are SQL (PlacesContent).
 *
 * Pure: no database, so the controller loads the rows once and pages the result.
 */
class SearchPlacesRanking
{
    /** Sorts the search accepts, with their natural direction */
    public const SORTS = [
        'distance'   => 'ASC',
        'views'      => 'DESC',
        'rating'     => 'DESC',
        'comments'   => 'DESC',
        'created_at' => 'DESC',
    ];

    /**
     * Rows sorted by a field in its natural direction (or the given one); `relevance` and
     * unknown sorts keep the relevance order. Places without the value go last, and equal
     * values keep the relevance order.
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    public static function sort(array $rows, ?string $sort, ?string $order = null): array
    {
        if (!$sort || !isset(self::SORTS[$sort])) {
            return array_values($rows);
        }

        $order     = strtoupper((string) $order);
        $direction = in_array($order, ['ASC', 'DESC'], true) ? $order : self::SORTS[$sort];

        $indexed = [];
        foreach (array_values($rows) as $position => $row) {
            $indexed[] = [$position, $row];
        }

        usort($indexed, static function (array $a, array $b) use ($sort, $direction) {
            $aVal = $a[1][$sort] ?? null;
            $bVal = $b[1][$sort] ?? null;

            if ($aVal === null || $bVal === null) {
                $cmp = ($aVal === null) <=> ($bVal === null);
            } else {
                $cmp = is_numeric($aVal) && is_numeric($bVal) ? (float) $aVal <=> (float) $bVal : $aVal <=> $bVal;
                $cmp = $direction === 'ASC' ? $cmp : -$cmp;
            }

            return $cmp ?: $a[0] <=> $b[0];
        });

        return array_map(static fn (array $item) => $item[1], $indexed);
    }
}
