<?php

/**
 * Full rebuild of location_countries/regions/districts/localities, re-
 * geocoding every place's coordinates through the new Nominatim-based
 * matching order (osm id → ISO code → normalized-name alias → create —
 * see App\Libraries\Geocoder). One-time command, run once after deploying
 * the 2026-10-09 migrations, that merges the duplicate locations the old
 * exact-name matching created (see features/20-location-seo-pages.md,
 * "Дубли локаций от геокодера") and assigns slugs to everything.
 *
 * Usage:
 *   php spark locations:rebuild --dry-run [--limit N]
 *   php spark locations:rebuild --apply   [--limit N] [--fresh]
 *
 * --dry-run geocodes every place and writes the report, but changes no
 * existing place, collection, or location row. It is NOT fully side-effect
 * free: "build alongside" means the geocoder may create brand-new location
 * rows for coordinates that match no existing name (just as it would for a
 * live place create) and populates the alias table — both purely additive
 * and safe to leave in place even if you stop after the dry run.
 *
 * --apply does the same geocoding, then in one transaction: updates every
 * place's country/region/district/locality/address fields to the new ids,
 * remaps any collection pointing at a merged id, records every merge in
 * location_legacy_ids, and deletes the now-orphaned old location rows —
 * strictly in that order, because places.country_id (etc.) is
 * ON DELETE CASCADE: deleting a location row before its places have moved
 * off it would delete the places, not just unlink them. Collections' FK is
 * ON DELETE SET NULL, so they are remapped first too, or a merge would
 * silently clear them. Finally assigns slugs to every location that still
 * lacks one (via LocationSlugLibrary::assignAll()).
 *
 * Resumable: the geocoding result for each place is saved to
 * writable/locations_rebuild_progress.json as soon as it is computed, so a
 * crash, Ctrl-C, or a Nominatim outage loses at most the one place in
 * flight — re-run the same command and it skips everything already done.
 * --fresh discards that file and starts over from scratch.
 */

namespace App\Commands;

use App\Libraries\Geocoder;
use App\Libraries\LocationMerge;
use App\Libraries\LocationSlugLibrary;
use App\Models\CollectionsModel;
use App\Models\LocationAliasesModel;
use App\Models\LocationCountriesModel;
use App\Models\LocationDistrictsModel;
use App\Models\LocationLegacyIdsModel;
use App\Models\LocationLocalitiesModel;
use App\Models\LocationRegionsModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;
use RuntimeException;
use Throwable;

class LocationsRebuild extends BaseCommand
{
    protected $group       = 'locations';
    protected $name        = 'locations:rebuild';
    protected $description = 'Re-geocode every place through the new matching order, merge duplicate locations, and assign slugs';
    protected $usage       = 'locations:rebuild (--dry-run|--apply) [--limit N] [--fresh]';
    protected $options     = [
        '--dry-run' => 'Geocode and report; change no existing place/collection/location row',
        '--apply'   => 'Geocode, then switch places and collections to the new ids and remove merged duplicates',
        '--limit'   => 'Only process the first N places, ordered by id — for a trial run',
        '--fresh'   => 'Discard saved progress from a previous (interrupted) run and start over',
    ];

    private const LEVELS = ['country', 'region', 'district', 'locality'];

    public function run(array $params)
    {
        $dryRun = CLI::getOption('dry-run') !== null;
        $apply  = CLI::getOption('apply') !== null;

        if ($dryRun === $apply) {
            CLI::error('Pass exactly one of --dry-run or --apply.');
            return;
        }

        $limit = CLI::getOption('limit') ? (int) CLI::getOption('limit') : null;

        if (CLI::getOption('fresh') !== null && is_file($this->progressFile())) {
            unlink($this->progressFile());
        }

        CLI::write('Phase 1/3: loading existing location names into the alias table...', 'yellow');
        $this->preloadAliases();

        CLI::write('Phase 2/3: re-geocoding places (throttled to Nominatim\'s 1 request/second policy — this takes a while)...', 'yellow');
        $progress = $this->geocodeAllPlaces($limit);

        CLI::write('Building the report...', 'yellow');
        $report = $this->buildReport($progress);
        $this->writeReport($report, $dryRun);

        if ($dryRun) {
            CLI::write('Dry run — no existing place, collection, or location row was changed.', 'green');
            return;
        }

        CLI::write('Phase 3/3: switching places and collections, removing merged duplicates...', 'yellow');

        if (!$this->applySwitch($progress, $report)) {
            return;
        }

        CLI::write('Assigning slugs to every location that still lacks one...', 'yellow');
        $slugReport = (new LocationSlugLibrary())->assignAll();
        CLI::write('Slugs: ' . json_encode($slugReport), 'green');

        CLI::write('Done.', 'green');
    }

    private function progressFile(): string
    {
        return WRITEPATH . 'locations_rebuild_progress.json';
    }

    // -------------------------------------------------------------------------
    // Phase 1: alias preload
    // -------------------------------------------------------------------------

    /**
     * Loads title_en/title_ru of every currently-existing location into the
     * alias table, per level ordered by places_count DESC (most places
     * first) so that when two old rows share a normalized name, the alias
     * slot — and so the geocoder's match in Phase 2 — goes to the one with
     * more places. This single ordering rule is what performs the merge:
     * every place that used to point at the lower-count duplicate resolves,
     * via that shared alias, to the higher-count one instead.
     */
    private function preloadAliases(): void
    {
        $aliasModel   = new LocationAliasesModel();
        $placesCounts = (new LocationSlugLibrary())->placesCountsByLocation();

        $rowsByLevel = [
            'country'  => (new LocationCountriesModel())->select('id, title_en, title_ru')->findAll(),
            'region'   => (new LocationRegionsModel())->select('id, title_en, title_ru, country_id')->findAll(),
            'district' => (new LocationDistrictsModel())->select('id, title_en, title_ru, region_id')->findAll(),
            'locality' => (new LocationLocalitiesModel())->select('id, title_en, title_ru, district_id, region_id, country_id')->findAll(),
        ];

        foreach (self::LEVELS as $type) {
            $rowsById = [];
            $candidates = [];

            foreach ($rowsByLevel[$type] as $row) {
                $rowsById[(int) $row->id] = $row;
                $candidates[] = ['id' => (int) $row->id, 'places_count' => $placesCounts[$type][$row->id] ?? 0];
            }

            $rows = array_map(
                static fn (array $candidate) => $rowsById[$candidate['id']],
                LocationMerge::sortByPriority($candidates)
            );

            foreach ($rows as $row) {
                $parentId = match ($type) {
                    'country'  => 0,
                    'region'   => (int) $row->country_id,
                    'district' => (int) $row->region_id,
                    'locality' => (int) ($row->district_id ?: ($row->region_id ?: $row->country_id)),
                };

                $aliasModel->remember($type, (int) $row->id, $parentId, $row->title_ru);
                $aliasModel->remember($type, (int) $row->id, $parentId, $row->title_en);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Phase 2: geocoding (resumable)
    // -------------------------------------------------------------------------

    /**
     * @return array<string, array<string, mixed>> place id => geocode result
     */
    private function geocodeAllPlaces(?int $limit): array
    {
        $progress = $this->loadProgress();

        $db    = Database::connect();
        $query = $db->table('places')
            ->select('id, lat, lon')
            ->where('deleted_at IS NULL', null, false)
            ->orderBy('id', 'ASC');

        if ($limit) {
            $query->limit($limit);
        }

        $places = $query->get()->getResult();
        $total  = count($places);
        $done   = 0;

        // One instance for the whole run: its in-memory hierarchy cache means
        // places sharing a region/district/locality skip repeat Nominatim calls.
        $geocoder = new Geocoder();

        foreach ($places as $place) {
            $done++;

            if (array_key_exists($place->id, $progress)) {
                continue;
            }

            try {
                $ok = $geocoder->coordinates((float) $place->lat, (float) $place->lon);

                $progress[$place->id] = $ok ? [
                    'ok'          => true,
                    'country_id'  => $geocoder->countryId,
                    'region_id'   => $geocoder->regionId,
                    'district_id' => $geocoder->districtId,
                    'locality_id' => $geocoder->localityId,
                    'address_en'  => $geocoder->addressEn,
                    'address_ru'  => $geocoder->addressRu,
                ] : ['ok' => false];
            } catch (Throwable $e) {
                log_message('error', 'locations:rebuild failed for place {id}: {exception}', [
                    'id' => $place->id, 'exception' => $e,
                ]);
                $progress[$place->id] = ['ok' => false, 'error' => $e->getMessage()];
            }

            // Persisted after every place — a crash loses at most the one in flight.
            $this->saveProgress($progress);

            if ($done % 25 === 0 || $done === $total) {
                CLI::write("  {$done}/{$total} places geocoded");
            }
        }

        return $progress;
    }

    private function loadProgress(): array
    {
        if (!is_file($this->progressFile())) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($this->progressFile()), true);

        return is_array($decoded) ? $decoded : [];
    }

    private function saveProgress(array $progress): void
    {
        file_put_contents($this->progressFile(), json_encode($progress));
    }

    // -------------------------------------------------------------------------
    // Report
    // -------------------------------------------------------------------------

    /**
     * @param array<string, array<string, mixed>> $progress
     * @return array{total_places: int, failed_count: int, failed_places: array,
     *               level_changed: array, legacy_map: array, merged_groups: array,
     *               stale_references: array, child_location_remaps: array}
     */
    private function buildReport(array $progress): array
    {
        $db    = Database::connect();
        $old   = $db->table('places')
            ->select('id, country_id, region_id, district_id, locality_id')
            ->where('deleted_at IS NULL', null, false)
            ->get()->getResult();

        $oldById = [];
        foreach ($old as $row) {
            $oldById[$row->id] = $row;
        }

        $failed      = [];
        $changed     = array_fill_keys(self::LEVELS, 0);
        $moveCounts  = array_fill_keys(self::LEVELS, []); // oldId => [destinationKey => count]
        $columns     = ['country' => 'country_id', 'region' => 'region_id', 'district' => 'district_id', 'locality' => 'locality_id'];

        foreach ($progress as $placeId => $result) {
            if (empty($result['ok'])) {
                $failed[] = $placeId;
                continue;
            }

            $oldRow = $oldById[$placeId] ?? null;

            foreach ($columns as $type => $column) {
                $oldId = $oldRow && $oldRow->$column !== null ? (int) $oldRow->$column : null;
                $newId = $result[$column] !== null ? (int) $result[$column] : null;

                if ($oldId !== $newId) {
                    $changed[$type]++;
                }

                if ($oldId !== null) {
                    $destinationKey = $newId === null ? '__null__' : (string) $newId;
                    $moveCounts[$type][$oldId][$destinationKey] = ($moveCounts[$type][$oldId][$destinationKey] ?? 0) + 1;
                }
            }
        }

        $legacyMap    = array_fill_keys(self::LEVELS, []);
        $mergedGroups = [];

        foreach ($moveCounts as $type => $byOldId) {
            foreach ($byOldId as $oldId => $destinations) {
                arsort($destinations);
                $winnerKey = array_key_first($destinations);

                if ($winnerKey === '__null__') {
                    continue; // most of this location's places now have no level here — nothing sensible to redirect to
                }

                $winnerId = (int) $winnerKey;

                if ($winnerId !== $oldId) {
                    $legacyMap[$type][$oldId] = $winnerId;
                    $mergedGroups[] = [
                        'type'         => $type,
                        'old_id'       => $oldId,
                        'new_id'       => $winnerId,
                        'places_moved' => $destinations[$winnerKey],
                    ];
                }
            }
        }

        // Places that currently reference a merged-away id but will NOT be
        // touched by the per-place update in applySwitch() — soft-deleted
        // places, places that failed to geocode this run, or (with --limit)
        // places outside this run's scope. applySwitch() keeps these valid
        // with a blanket remap onto the legacy map's new id, run before any
        // old row is deleted; listed here so a dry run shows them too.
        $staleReferences = array_fill_keys(self::LEVELS, []);

        foreach ($legacyMap as $type => $map) {
            if (empty($map)) {
                continue;
            }

            $column = $columns[$type];
            $totals = $db->table('places')
                ->select("{$column} AS location_id, COUNT(*) AS cnt")
                ->whereIn($column, array_keys($map))
                ->groupBy($column)
                ->get()->getResult();

            $totalById = [];
            foreach ($totals as $row) {
                $totalById[(int) $row->location_id] = (int) $row->cnt;
            }

            foreach ($map as $oldId => $newId) {
                $movedAway = array_sum($moveCounts[$type][$oldId] ?? []);
                $stale     = ($totalById[$oldId] ?? 0) - $movedAway;

                if ($stale > 0) {
                    $staleReferences[$type][$oldId] = $stale;
                }
            }
        }

        // Districts/localities whose own country_id/region_id/district_id FK
        // points at a merged-away parent — these are FKs too (ON DELETE
        // CASCADE, same as places.*_id), so applySwitch() remaps them before
        // deleting the parent, whether or not the child row itself survives
        // the merge. Listed here so a dry run shows the full blast radius.
        $childLocationRemaps = array_fill_keys(self::LEVELS, []);

        foreach (array_keys($legacyMap['country']) as $oldId) {
            $districts  = (int) $db->table('location_districts')->where('country_id', $oldId)->countAllResults();
            $localities = (int) $db->table('location_localities')->where('country_id', $oldId)->countAllResults();

            if ($districts || $localities) {
                $childLocationRemaps['country'][$oldId] = ['districts' => $districts, 'localities' => $localities];
            }
        }

        foreach (array_keys($legacyMap['region']) as $oldId) {
            $districts  = (int) $db->table('location_districts')->where('region_id', $oldId)->countAllResults();
            $localities = (int) $db->table('location_localities')->where('region_id', $oldId)->countAllResults();

            if ($districts || $localities) {
                $childLocationRemaps['region'][$oldId] = ['districts' => $districts, 'localities' => $localities];
            }
        }

        foreach (array_keys($legacyMap['district']) as $oldId) {
            $localities = (int) $db->table('location_localities')->where('district_id', $oldId)->countAllResults();

            if ($localities) {
                $childLocationRemaps['district'][$oldId] = ['localities' => $localities];
            }
        }

        return [
            'total_places'           => count($progress),
            'failed_count'           => count($failed),
            'failed_places'          => $failed,
            'level_changed'          => $changed,
            'legacy_map'             => $legacyMap,
            'merged_groups'          => $mergedGroups,
            'stale_references'       => $staleReferences,
            'child_location_remaps'  => $childLocationRemaps,
        ];
    }

    private function writeReport(array $report, bool $dryRun): void
    {
        CLI::write('--- Report ---', 'cyan');
        CLI::write("Places processed: {$report['total_places']}, failed to geocode: {$report['failed_count']}");
        CLI::write('Places whose level changed: ' . json_encode($report['level_changed']));
        CLI::write('Duplicate groups to merge: ' . count($report['merged_groups']));

        foreach (array_slice($report['merged_groups'], 0, 20) as $group) {
            CLI::write("  {$group['type']} {$group['old_id']} -> {$group['new_id']} ({$group['places_moved']} places)");
        }

        if (count($report['merged_groups']) > 20) {
            CLI::write('  ... and ' . (count($report['merged_groups']) - 20) . ' more (see the saved report)');
        }

        $staleTotal = array_sum(array_map('array_sum', $report['stale_references']));

        if ($staleTotal > 0) {
            CLI::write("Places kept valid by a blanket remap (soft-deleted / failed to geocode / outside --limit): {$staleTotal}", 'yellow');

            foreach ($report['stale_references'] as $type => $byOldId) {
                foreach ($byOldId as $oldId => $count) {
                    CLI::write("  {$type} {$oldId}: {$count} place(s)");
                }
            }
        }

        $childRemapTotal = 0;
        foreach ($report['child_location_remaps'] as $byOldId) {
            foreach ($byOldId as $counts) {
                $childRemapTotal += array_sum($counts);
            }
        }

        if ($childRemapTotal > 0) {
            CLI::write("Child location rows reparented onto the surviving id (district/locality FKs): {$childRemapTotal}", 'yellow');

            foreach ($report['child_location_remaps'] as $type => $byOldId) {
                foreach ($byOldId as $oldId => $counts) {
                    $parts = implode(', ', array_map(static fn ($k, $v) => "{$v} {$k}", array_keys($counts), $counts));
                    CLI::write("  {$type} {$oldId}: {$parts}");
                }
            }
        }

        $path = WRITEPATH . 'locations_rebuild_report_' . date('Ymd_His') . ($dryRun ? '_dry-run' : '') . '.json';
        file_put_contents($path, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        CLI::write("Full report saved to {$path}", 'green');
    }

    // -------------------------------------------------------------------------
    // Phase 3: switch (--apply only)
    // -------------------------------------------------------------------------

    /**
     * @return bool true when the switch committed, false when it was aborted (nothing changed)
     */
    private function applySwitch(array $progress, array $report): bool
    {
        $db = Database::connect();
        $columns = ['country' => 'country_id', 'region' => 'region_id', 'district' => 'district_id', 'locality' => 'locality_id'];

        $db->transStart();

        try {
            // 1. Blanket remap EVERY remaining reference off a merged-away id
            //    onto its surviving id — including soft-deleted places and
            //    places that failed to geocode this run (see buildReport()'s
            //    stale_references), which the per-place loop below never
            //    touches. Done first, and before any delete, so nothing is
            //    ever left pointing at a row that is about to be removed.
            //
            //    This also covers location_districts.country_id/region_id and
            //    location_localities.country_id/region_id/district_id: those
            //    are FKs too (ON DELETE CASCADE, same as places.*_id), and a
            //    district/locality that is itself KEPT (not merged) but whose
            //    parent merged away would otherwise still point at the old
            //    parent — deleting that parent would then cascade-delete the
            //    child, and in turn the child's own places, right past the
            //    guard in step 3. No ordering dependency between these: each
            //    level's remap touches a different column.
            foreach ($report['legacy_map'] as $type => $map) {
                $column = $columns[$type];

                foreach ($map as $oldId => $newId) {
                    $db->table('places')->where($column, $oldId)->update([$column => $newId]);

                    if ($type === 'country') {
                        $db->table('location_districts')->where('country_id', $oldId)->update(['country_id' => $newId]);
                        $db->table('location_localities')->where('country_id', $oldId)->update(['country_id' => $newId]);
                    } elseif ($type === 'region') {
                        $db->table('location_districts')->where('region_id', $oldId)->update(['region_id' => $newId]);
                        $db->table('location_localities')->where('region_id', $oldId)->update(['region_id' => $newId]);
                    } elseif ($type === 'district') {
                        $db->table('location_localities')->where('district_id', $oldId)->update(['district_id' => $newId]);
                    }
                }
            }

            // Collections' FK is ON DELETE SET NULL — remap for the same reason.
            foreach (['country', 'region'] as $type) {
                foreach ($report['legacy_map'][$type] as $oldId => $newId) {
                    $db->table('collections')->where($type . '_id', $oldId)->update([$type . '_id' => $newId]);
                }
            }

            // 2. Apply each successfully-geocoded place's precise new values
            //    (location ids + fresh address text) — authoritative over step 1
            //    for these places. Raw builder, not PlacesModel: this is an
            //    internal data correction, not a user edit, so it should not
            //    bump places.updated_at.
            foreach ($progress as $placeId => $result) {
                if (empty($result['ok'])) {
                    continue; // kept valid by step 1's blanket remap instead
                }

                $db->table('places')->where('id', $placeId)->update([
                    'country_id'  => $result['country_id'],
                    'region_id'   => $result['region_id'],
                    'district_id' => $result['district_id'],
                    'locality_id' => $result['locality_id'],
                    'address_en'  => $result['address_en'],
                    'address_ru'  => $result['address_ru'],
                ]);
            }

            // 3. Record every merge for the future 301, then delete the old
            //    rows — but only once verified nothing references them any
            //    more (places.*_id AND location_districts/location_localities'
            //    own parent FKs are all ON DELETE CASCADE; a stray reference
            //    here would silently delete that row instead of just
            //    unlinking it). Any non-zero count means step 1/2 above
            //    missed a reference — abort the whole switch rather than
            //    delete a location something still points to.
            //
            //    Bottom-up (locality → district → region → country): by the
            //    time a region is deleted, every district/locality that used
            //    to point at it has already been remapped (step 1) or, if it
            //    was itself merged away, already deleted in this same loop —
            //    so the child-reference count below is a real verification,
            //    not just an optimistic check.
            $legacyModel = new LocationLegacyIdsModel();
            $models = [
                'country'  => new LocationCountriesModel(),
                'region'   => new LocationRegionsModel(),
                'district' => new LocationDistrictsModel(),
                'locality' => new LocationLocalitiesModel(),
            ];

            foreach (array_reverse(self::LEVELS) as $type) {
                $column = $columns[$type];

                foreach ($report['legacy_map'][$type] as $oldId => $newId) {
                    $remainingPlaces = $db->table('places')->where($column, $oldId)->countAllResults();
                    $remainingCollections = in_array($type, ['country', 'region'], true)
                        ? $db->table('collections')->where($type . '_id', $oldId)->countAllResults()
                        : 0;

                    $remainingChildren = 0;

                    if ($type === 'country') {
                        $remainingChildren = $db->table('location_districts')->where('country_id', $oldId)->countAllResults()
                            + $db->table('location_localities')->where('country_id', $oldId)->countAllResults();
                    } elseif ($type === 'region') {
                        $remainingChildren = $db->table('location_districts')->where('region_id', $oldId)->countAllResults()
                            + $db->table('location_localities')->where('region_id', $oldId)->countAllResults();
                    } elseif ($type === 'district') {
                        $remainingChildren = $db->table('location_localities')->where('district_id', $oldId)->countAllResults();
                    }

                    if ($remainingPlaces > 0 || $remainingCollections > 0 || $remainingChildren > 0) {
                        throw new RuntimeException(
                            "Refusing to delete {$type} {$oldId} -> {$newId}: still referenced by "
                            . "{$remainingPlaces} place(s), {$remainingCollections} collection(s), "
                            . "and {$remainingChildren} child location row(s)."
                        );
                    }

                    $legacyModel->insert(['location_type' => $type, 'old_id' => $oldId, 'new_id' => $newId]);
                    $models[$type]->delete($oldId, true); // hard delete — frees its osm/iso unique slots too
                }
            }
        } catch (Throwable $e) {
            $db->transRollback();
            log_message('error', 'locations:rebuild switch aborted: {exception}', ['exception' => $e]);
            CLI::error('Switch aborted — nothing was changed: ' . $e->getMessage());
            CLI::error('progress.json is intact, so re-running --apply will not repeat the geocoding.');

            return false;
        }

        $db->transComplete();

        if (!$db->transStatus()) {
            CLI::error('Switch transaction failed — nothing was changed. Check the log; progress.json is intact, so re-running --apply will not repeat the geocoding.');

            return false;
        }

        // Spec: recompute collections' region/country from their places,
        // using the existing autofillTheme() logic, for anything still unset.
        $collectionsModel = new CollectionsModel();
        $stillEmpty = $db->table('collections')
            ->select('id')
            ->where('region_id', null)
            ->where('deleted_at IS NULL', null, false)
            ->get()->getResult();

        foreach ($stillEmpty as $row) {
            $collectionsModel->autofillTheme($row->id);
        }

        CLI::write('Switch complete.', 'green');

        return true;
    }
}
