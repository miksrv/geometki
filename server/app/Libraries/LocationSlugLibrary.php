<?php

namespace App\Libraries;

use App\Models\CategoryModel;
use App\Models\LocationCountriesModel;
use App\Models\LocationDistrictsModel;
use App\Models\LocationLocalitiesModel;
use App\Models\LocationRegionsModel;
use App\Models\LocationSlugHistoryModel;
use App\Models\LocationSlugsModel;
use Config\Database;
use Config\LocationSlugs;

/**
 * Generates and persists location slugs — see "Слаги локаций" in
 * features/20-location-seo-pages.md.
 *
 * Two entry points:
 *  - assignForNewLocation() — one location, called by Geocoder right after
 *    it creates a new country/region/district/locality row.
 *  - assignAll() — every location that does not have a slug yet (or, with
 *    $regenerate, every location), called by `php spark locations:rebuild`
 *    after the dedup switch.
 *
 * Both funnel into the static, DB-free claimSlug()/qualifySlug() so the
 * collision/reserved-word/qualification rules are unit-tested without a
 * database — see tests/unit/LocationSlugLibraryTest.php.
 *
 * TODO: grammatical case forms (name_genitive_ru, name_prepositional_ru —
 * see "Морфология и шаблоны заголовков" in features/20-location-seo-pages.md)
 * are out of scope here; no column or generation for them exists yet.
 */
class LocationSlugLibrary
{
    private LocationSlugs $config;
    private LocationSlugsModel $slugsModel;
    private LocationSlugHistoryModel $historyModel;

    public function __construct(
        ?LocationSlugs $config = null,
        ?LocationSlugsModel $slugsModel = null,
        ?LocationSlugHistoryModel $historyModel = null
    ) {
        $this->config       = $config ?? config('LocationSlugs');
        $this->slugsModel   = $slugsModel ?? new LocationSlugsModel();
        $this->historyModel = $historyModel ?? new LocationSlugHistoryModel();
    }

    // -------------------------------------------------------------------------
    // Pure logic (no DB) — unit-tested directly
    // -------------------------------------------------------------------------

    /**
     * Qualifies a base slug with a parent slug: "parizh" + "chelyabinskaya-oblast"
     * → "parizh-chelyabinskaya-oblast". Collapses repeated dashes and cuts to
     * 80 characters on a word boundary, same rule as place slugs.
     *
     * @param string $baseSlug
     * @param string $parentSlug
     * @return string|null null if both inputs are empty of slug characters
     */
    public static function qualifySlug(string $baseSlug, string $parentSlug): ?string
    {
        $combined = trim($baseSlug, '-') . '-' . trim($parentSlug, '-');
        $combined = preg_replace('/-+/', '-', $combined);
        $combined = trim((string) $combined, '-');

        if ($combined === '') {
            return null;
        }

        if (mb_strlen($combined, 'UTF-8') > 80) {
            $combined = mb_substr($combined, 0, 80, 'UTF-8');
            $lastDash = mb_strrpos($combined, '-', 0, 'UTF-8');

            if ($lastDash !== false) {
                $combined = mb_substr($combined, 0, $lastDash, 'UTF-8');
            }

            $combined = trim($combined, '-');
        }

        return $combined === '' ? null : $combined;
    }

    /**
     * Decides which slug a location gets: the clean base slug if it is free
     * and not reserved, otherwise the base qualified by the nearest parent
     * that makes it unique, tried in the given order (nearest parent first).
     * As a last resort (should not happen once duplicate locations are
     * merged) it suffixes the entity id — not a plain numeric suffix like
     * "-2", which the spec explicitly rules out as meaningless, but
     * "-l{id}" so it is traceable and still never collides.
     *
     * A candidate that is reserved for starting with 13 hex characters (see
     * isReserved()) is qualified parent-first ("{parent}-{candidate}")
     * instead of the usual candidate-first ("{candidate}-{parent}"): the
     * hex prefix is a "starts with" rule, so appending after it would still
     * leave the result starting with 13 hex characters and reserved again.
     * Putting the parent first guarantees the prefix moves off position 0
     * (parent slugs never start with 13 hex characters themselves — they
     * came from the exact same generation rules). A literal reserved WORD
     * (a category name, a service word) doesn't care about order, since
     * that check is an exact match, not a prefix.
     *
     * @param string               $base             From generateLocationBaseSlug()
     * @param string[]             $parentSlugChain  Nearest parent first; empty/null entries are skipped
     * @param string[]             $reservedWords
     * @param callable(string): bool $isTaken        Whether a slug is already used by another location
     * @param int                  $entityId         For the extreme fallback suffix only
     * @return array{slug: string, isPrimary: bool, method: string} method is one of clean|qualified|fallback
     */
    public static function claimSlug(
        string $base,
        array $parentSlugChain,
        array $reservedWords,
        callable $isTaken,
        int $entityId
    ): array {
        if (!self::isReserved($base, $reservedWords) && !$isTaken($base)) {
            return ['slug' => $base, 'isPrimary' => true, 'method' => 'clean'];
        }

        $candidate = $base;

        foreach (array_filter($parentSlugChain) as $parentSlug) {
            $qualified = self::isHexPrefixed($candidate)
                ? self::qualifySlug($parentSlug, $candidate)
                : self::qualifySlug($candidate, $parentSlug);

            if ($qualified === null) {
                continue;
            }

            if (!self::isReserved($qualified, $reservedWords) && !$isTaken($qualified)) {
                return ['slug' => $qualified, 'isPrimary' => false, 'method' => 'qualified'];
            }

            $candidate = $qualified;
        }

        return ['slug' => substr($candidate . '-l' . $entityId, 0, 90), 'isPrimary' => false, 'method' => 'fallback'];
    }

    /**
     * A slug is reserved either because it is literally in $reservedWords
     * (category names, service words — see Config\LocationSlugs::$reservedWords)
     * or because it starts with 13 hex characters, the place id format
     * (App\Models\ApplicationBaseModel::generateId()) — such a slug would be
     * indistinguishable from "/places/{id}-{slug}" place URLs.
     *
     * @param string[] $reservedWords
     */
    private static function isReserved(string $slug, array $reservedWords): bool
    {
        return in_array($slug, $reservedWords, true) || self::isHexPrefixed($slug);
    }

    /**
     * Whether a slug starts with 13 hex characters — the place id format.
     * See isReserved() and the ordering note on claimSlug().
     */
    private static function isHexPrefixed(string $slug): bool
    {
        return preg_match('/^[0-9a-f]{13}/i', $slug) === 1;
    }

    // -------------------------------------------------------------------------
    // Orchestration (DB) — used by Geocoder and the rebuild command
    // -------------------------------------------------------------------------

    /**
     * Assigns a slug to one newly-created location. The parent chain is
     * known by the caller (Geocoder already resolved/created the ancestors
     * in this same request), so no cross-location lookup is needed beyond
     * the taken/reserved checks.
     *
     * @param string   $type            country|region|district|locality
     * @param int      $entityId
     * @param string   $titleRu
     * @param string[] $parentSlugChain Nearest parent first (e.g. [districtSlug, regionSlug, countrySlug])
     * @return string the assigned slug
     */
    public function assignForNewLocation(string $type, int $entityId, string $titleRu, array $parentSlugChain): string
    {
        helper('slug');

        $base = generateLocationBaseSlug($titleRu, $this->config->settlementTypeWords) ?? ('location-' . $entityId);
        $claim = self::claimSlug(
            $base,
            $parentSlugChain,
            $this->reservedWordsSet(),
            fn (string $slug): bool => $this->slugsModel->isTaken($slug),
            $entityId
        );

        $this->slugsModel->insert([
            'slug'       => $claim['slug'],
            'type'       => $type,
            'entity_id'  => $entityId,
            'is_primary' => $claim['isPrimary'],
        ]);

        return $claim['slug'];
    }

    /**
     * Assigns slugs to every location that does not have one yet (or, with
     * $regenerate, recomputes every slug — writing the previous one to
     * history whenever it changes). Processes country, then region, then
     * district, then locality, each level sorted by places_count DESC: that
     * single pass is enough to realize both collision rules at once —
     * higher-priority levels claim their clean slug first (levelPriority),
     * and within a level the entity with the most places claims it first
     * (the "most places wins" heuristic, same rule as LocationMerge::pickPrimary()).
     *
     * @param bool $regenerate
     * @return array<string, int> counts: clean, qualified, fallback, skipped_existing, reassigned
     */
    public function assignAll(bool $regenerate = false): array
    {
        helper('slug');

        $placesCounts = $this->placesCountsByLocation();
        $reserved     = $this->reservedWordsSet();
        $entities     = $this->collectEntities($placesCounts);
        $priority     = $this->config->levelPriority;

        // Group by level first (stable — preserves collectEntities()'s order
        // within a level), then apply LocationMerge's tested "most places
        // first, lowest id breaks ties" ordering within each level: that
        // single pass is what lets a higher-priority level's entities claim
        // their clean slug before a lower one's, and the entity with the
        // most places claim it first within its own level.
        $byLevel = [];
        foreach ($entities as $entity) {
            $byLevel[$entity['type']][] = $entity;
        }

        uksort($byLevel, static fn (string $a, string $b): int => $priority[$a] <=> $priority[$b]);

        $entities = [];
        foreach ($byLevel as $levelEntities) {
            $entitiesById = [];
            $candidates   = [];

            foreach ($levelEntities as $entity) {
                $entitiesById[$entity['id']] = $entity;
                $candidates[] = ['id' => $entity['id'], 'places_count' => $entity['places_count']];
            }

            foreach (LocationMerge::sortByPriority($candidates) as $candidate) {
                $entities[] = $entitiesById[$candidate['id']];
            }
        }

        $report = ['clean' => 0, 'qualified' => 0, 'fallback' => 0, 'skipped_existing' => 0, 'reassigned' => 0];
        $resolvedSlugs = [];

        foreach ($entities as $entity) {
            $key      = $entity['type'] . ':' . $entity['id'];
            $existing = $this->slugsModel->findFor($entity['type'], $entity['id']);

            if ($existing && !$regenerate) {
                $resolvedSlugs[$key] = $existing->slug;
                $report['skipped_existing']++;
                continue;
            }

            $base  = generateLocationBaseSlug($entity['title_ru'], $this->config->settlementTypeWords)
                ?? ('location-' . $entity['id']);
            $chain = $this->parentSlugChain($entity, $resolvedSlugs);

            $claim = self::claimSlug(
                $base,
                $chain,
                $reserved,
                fn (string $slug): bool => $this->slugsModel->isTaken($slug),
                $entity['id']
            );

            if ($existing && $existing->slug !== $claim['slug']) {
                $this->historyModel->insert([
                    'old_slug'  => $existing->slug,
                    'type'      => $entity['type'],
                    'entity_id' => $entity['id'],
                ]);
                $this->slugsModel->update($existing->id, [
                    'slug'       => $claim['slug'],
                    'is_primary' => $claim['isPrimary'],
                ]);
                $report['reassigned']++;
            } elseif (!$existing) {
                $this->slugsModel->insert([
                    'slug'       => $claim['slug'],
                    'type'       => $entity['type'],
                    'entity_id'  => $entity['id'],
                    'is_primary' => $claim['isPrimary'],
                ]);
            }

            $resolvedSlugs[$key] = $claim['slug'];
            $report[$claim['method']]++;
        }

        return $report;
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /**
     * Reserved slugs: every category name (read live from the `category`
     * table) plus the service words in Config\LocationSlugs::$reservedWords.
     *
     * @return string[]
     */
    private function reservedWordsSet(): array
    {
        $categories = (new CategoryModel())->findColumn('name') ?? [];

        return array_values(array_unique(array_map(
            static fn (string $word): string => mb_strtolower($word, 'UTF-8'),
            [...$categories, ...$this->config->reservedWords]
        )));
    }

    /**
     * @return array<string, array<int, int>> type => [location id => places count]
     */
    public function placesCountsByLocation(): array
    {
        $db     = Database::connect();
        $counts = ['country' => [], 'region' => [], 'district' => [], 'locality' => []];
        $columns = [
            'country'  => 'country_id',
            'region'   => 'region_id',
            'district' => 'district_id',
            'locality' => 'locality_id',
        ];

        foreach ($columns as $type => $column) {
            $rows = $db->table('places')
                ->select("{$column} AS location_id, COUNT(*) AS places_count")
                ->where("{$column} IS NOT NULL", null, false)
                ->where('deleted_at IS NULL', null, false)
                ->groupBy($column)
                ->get()
                ->getResult();

            foreach ($rows as $row) {
                $counts[$type][(int) $row->location_id] = (int) $row->places_count;
            }
        }

        return $counts;
    }

    /**
     * @param array<string, array<int, int>> $placesCounts
     * @return array<int, array{type: string, id: int, title_ru: string, country_id: ?int, region_id: ?int, district_id: ?int, places_count: int}>
     */
    private function collectEntities(array $placesCounts): array
    {
        $entities = [];

        foreach ((new LocationCountriesModel())->select('id, title_ru')->findAll() as $row) {
            $entities[] = [
                'type' => 'country', 'id' => (int) $row->id, 'title_ru' => $row->title_ru,
                'country_id' => null, 'region_id' => null, 'district_id' => null,
                'places_count' => $placesCounts['country'][$row->id] ?? 0,
            ];
        }

        foreach ((new LocationRegionsModel())->select('id, title_ru, country_id')->findAll() as $row) {
            $entities[] = [
                'type' => 'region', 'id' => (int) $row->id, 'title_ru' => $row->title_ru,
                'country_id' => $row->country_id, 'region_id' => null, 'district_id' => null,
                'places_count' => $placesCounts['region'][$row->id] ?? 0,
            ];
        }

        foreach ((new LocationDistrictsModel())->select('id, title_ru, country_id, region_id')->findAll() as $row) {
            $entities[] = [
                'type' => 'district', 'id' => (int) $row->id, 'title_ru' => $row->title_ru,
                'country_id' => $row->country_id, 'region_id' => $row->region_id, 'district_id' => null,
                'places_count' => $placesCounts['district'][$row->id] ?? 0,
            ];
        }

        foreach ((new LocationLocalitiesModel())->select('id, title_ru, country_id, region_id, district_id')->findAll() as $row) {
            $entities[] = [
                'type' => 'locality', 'id' => (int) $row->id, 'title_ru' => $row->title_ru,
                'country_id' => $row->country_id, 'region_id' => $row->region_id, 'district_id' => $row->district_id,
                'places_count' => $placesCounts['locality'][$row->id] ?? 0,
            ];
        }

        return $entities;
    }

    /**
     * Nearest-parent-first slug chain for an entity, resolved from slugs
     * already assigned earlier in this same assignAll() pass (parents are
     * always processed first — see the sort in assignAll()).
     *
     * @param array<string, mixed> $entity
     * @param array<string, string> $resolvedSlugs "type:id" => slug
     * @return string[]
     */
    private function parentSlugChain(array $entity, array $resolvedSlugs): array
    {
        $chain = [];

        if ($entity['type'] === 'locality' && $entity['district_id']) {
            $chain[] = $resolvedSlugs['district:' . $entity['district_id']] ?? null;
        }

        if (in_array($entity['type'], ['locality', 'district'], true) && $entity['region_id']) {
            $chain[] = $resolvedSlugs['region:' . $entity['region_id']] ?? null;
        }

        if ($entity['country_id']) {
            $chain[] = $resolvedSlugs['country:' . $entity['country_id']] ?? null;
        }

        return array_values(array_filter($chain, static fn ($slug) => $slug !== null));
    }
}
