<?php

namespace App\Libraries;

/**
 * Pure logic for "keep old ids for the main record": when several old
 * location rows turn out to be the same real-world place (duplicates the
 * old exact-name geocoder matching created, or several names colliding on
 * one slug), the one that already has the most places becomes/keeps the id
 * everyone else is mapped or qualified against — Orenburg stays id 1,
 * Bashkortostan stays id 2. Ties are broken by the lowest id, so the result
 * does not depend on array/iteration order.
 *
 * Used by `php spark locations:rebuild` to fill location_legacy_ids, and by
 * App\Libraries\LocationSlugLibrary for the same-level part of the slug
 * collision "who gets the clean slug" rule.
 */
class LocationMerge
{
    /**
     * @param array<int, array{id: int, places_count: int}> $candidates
     * @return int|null the winning id, or null when $candidates is empty
     */
    public static function pickPrimary(array $candidates): ?int
    {
        if (empty($candidates)) {
            return null;
        }

        return self::sortByPriority($candidates)[0]['id'];
    }

    /**
     * The same most-places-first, lowest-id-breaks-ties rule pickPrimary()
     * uses to pick its single winner, exposed as a full ordering for callers
     * that need the whole sequence rather than just the top candidate:
     *  - `php spark locations:rebuild`'s alias-preload pass (LocationsRebuild::preloadAliases())
     *    loads old location names into the alias table in this order, so a
     *    name shared by several old rows is claimed by the one that should
     *    survive the merge.
     *  - LocationSlugLibrary::assignAll()'s same-level pass processes
     *    entities in this order, so the entity with the most places claims
     *    the clean (unqualified) slug first.
     *
     * @param array<int, array{id: int, places_count: int}> $candidates
     * @return array<int, array{id: int, places_count: int}>
     */
    public static function sortByPriority(array $candidates): array
    {
        usort($candidates, static function (array $a, array $b): int {
            return $b['places_count'] <=> $a['places_count'] ?: $a['id'] <=> $b['id'];
        });

        return $candidates;
    }
}
