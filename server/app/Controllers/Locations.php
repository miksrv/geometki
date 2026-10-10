<?php

namespace App\Controllers;

use App\Models\LocationCountriesModel;
use App\Models\LocationDistrictsModel;
use App\Models\LocationLegacyIdsModel;
use App\Models\LocationLocalitiesModel;
use App\Models\LocationRegionsModel;
use App\Models\LocationSlugHistoryModel;
use App\Models\LocationSlugsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;

/**
 * Locations controller — the landing-page API for features/20-location-seo-pages.md
 * ("Технические требования → Эндпоинты"). Read-only: slug resolution, the
 * data behind a location's chips/children/description blocks.
 *
 * Every place has its country_id/region_id/district_id/locality_id set
 * directly (App\Libraries\Geocoder resolves the whole chain at once), so
 * "places in this location" never needs a recursive descendant lookup —
 * a plain `WHERE {level}_id = :id` already includes everything below it.
 *
 * `indexable` (placesCount >= Config\LocationSlugs::$indexThreshold) is
 * computed here, once, and returned alongside placesCount everywhere a
 * location/category/pair appears, so the client and the sitemap
 * (App\Controllers\Sitemap) never have to duplicate the threshold.
 *
 * @package App\Controllers
 */
class Locations extends ResourceController
{
    private const TYPES = ['country', 'region', 'district', 'locality'];

    private const COLUMNS = [
        'country'  => 'country_id',
        'region'   => 'region_id',
        'district' => 'district_id',
        'locality' => 'locality_id',
    ];

    /**
     * Resolves a location slug (or a pre-rebuild legacy id) to the entity it
     * names, for the landing-page router.
     *
     * GET /locations/resolve?slug=orenburg
     * GET /locations/resolve?type=region&legacyId=2
     *
     * @example GET /locations/resolve?slug=bashkortostan
     * @example GET /locations/resolve?type=region&legacyId=78
     *
     * @return ResponseInterface
     */
    public function resolve(): ResponseInterface
    {
        $locale   = $this->request->getLocale();
        $slug     = $this->request->getGet('slug', FILTER_SANITIZE_SPECIAL_CHARS);
        $type     = $this->request->getGet('type', FILTER_SANITIZE_SPECIAL_CHARS);
        $legacyId = $this->request->getGet('legacyId', FILTER_SANITIZE_NUMBER_INT);

        if ($legacyId !== null && $legacyId !== '') {
            return $this->resolveLegacyId($type, (int) $legacyId, $locale);
        }

        if (!$slug || !is_string($slug)) {
            return $this->failValidationErrors(lang('Locations.resolveSlugRequired'));
        }

        return $this->resolveSlug(trim($slug), $locale);
    }

    /**
     * Place categories present in a location (any descendant level
     * included — see the class docblock), with per-category place counts.
     *
     * GET /locations/:type/:id/categories
     *
     * @example GET /locations/region/2/categories
     *
     * @param string|null $type
     * @param int|null    $id
     * @return ResponseInterface
     */
    public function categories(?string $type = null, ?int $id = null): ResponseInterface
    {
        if (!in_array($type, self::TYPES, true) || !$id) {
            return $this->failValidationErrors(lang('Locations.typeInvalid'));
        }

        $threshold = config('LocationSlugs')->indexThreshold;
        $column    = self::COLUMNS[$type];

        $rows = Database::connect()
            ->table('places p')
            ->select('p.category as name, COUNT(p.id) as count')
            ->where("p.{$column}", $id)
            ->where('p.deleted_at IS NULL', null, false)
            ->where('p.category IS NOT NULL', null, false)
            ->groupBy('p.category')
            ->orderBy('count', 'DESC')
            ->get()->getResult();

        $items = array_map(static fn ($row) => [
            'name'      => $row->name,
            'count'     => (int) $row->count,
            'indexable' => (int) $row->count >= $threshold,
        ], $rows);

        return $this->respond(['items' => $items]);
    }

    /**
     * Direct child locations of a country (its regions), a region (its
     * districts and the localities that have no district of their own), or
     * a district (its localities) — for perelinking. A locality has none.
     *
     * GET /locations/:type/:id/children
     *
     * @example GET /locations/country/1/children
     *
     * @param string|null $type
     * @param int|null    $id
     * @return ResponseInterface
     */
    public function children(?string $type = null, ?int $id = null): ResponseInterface
    {
        if (!in_array($type, self::TYPES, true) || !$id) {
            return $this->failValidationErrors(lang('Locations.typeInvalid'));
        }

        $locale    = $this->request->getLocale();
        $threshold = config('LocationSlugs')->indexThreshold;
        $db        = Database::connect();
        $children  = [];

        if ($type === 'country') {
            $children = $this->fetchChildLevel($db, 'region', 'lr', 'country_id', $id, $locale);
        } elseif ($type === 'region') {
            $children = array_merge(
                $this->fetchChildLevel($db, 'district', 'ld', 'region_id', $id, $locale),
                $this->fetchChildLevel($db, 'locality', 'll', 'region_id', $id, $locale, 'district_id')
            );
            usort($children, static fn ($a, $b) => $b['placesCount'] <=> $a['placesCount']);
        } elseif ($type === 'district') {
            $children = $this->fetchChildLevel($db, 'locality', 'll', 'district_id', $id, $locale);
        }
        // 'locality' has no children — $children stays [].

        foreach ($children as &$child) {
            $child['indexable'] = $child['placesCount'] >= $threshold;
        }
        unset($child);

        return $this->respond(['items' => $children]);
    }

    /**
     * Data for a location's auto-generated description: total places, the
     * top categories with counts, and the date the most recent place was
     * added — see "Описание" in features/20-location-seo-pages.md.
     *
     * GET /locations/:type/:id/summary
     *
     * @example GET /locations/locality/1/summary
     *
     * @param string|null $type
     * @param int|null    $id
     * @return ResponseInterface
     */
    public function summary(?string $type = null, ?int $id = null): ResponseInterface
    {
        if (!in_array($type, self::TYPES, true) || !$id) {
            return $this->failValidationErrors(lang('Locations.typeInvalid'));
        }

        $threshold = config('LocationSlugs')->indexThreshold;
        $column    = self::COLUMNS[$type];
        $db        = Database::connect();

        $placesCount = (int) $db->table('places')
            ->where($column, $id)->where('deleted_at IS NULL', null, false)
            ->countAllResults();

        $topCategories = $db->table('places p')
            ->select('p.category as name, COUNT(p.id) as count')
            ->where("p.{$column}", $id)
            ->where('p.deleted_at IS NULL', null, false)
            ->where('p.category IS NOT NULL', null, false)
            ->groupBy('p.category')
            ->orderBy('count', 'DESC')
            ->limit(5)
            ->get()->getResult();

        $lastAdded = $db->table('places')
            ->select('MAX(created_at) as last_added')
            ->where($column, $id)->where('deleted_at IS NULL', null, false)
            ->get()->getRow();

        return $this->respond([
            'placesCount' => $placesCount,
            'indexable'   => $placesCount >= $threshold,
            'categories'  => array_map(static fn ($row) => [
                'name'  => $row->name,
                'count' => (int) $row->count,
            ], $topCategories),
            'lastAddedAt' => $lastAdded && $lastAdded->last_added
                ? (new \DateTime($lastAdded->last_added))->format(\DateTime::ATOM)
                : null,
        ]);
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private function resolveSlug(string $slug, string $locale): ResponseInterface
    {
        $slugsModel = new LocationSlugsModel();
        $current    = $slugsModel->findBySlug($slug);

        if ($current) {
            return $this->respond($this->buildResolvedLocation($current->type, $current->entity_id, $locale));
        }

        $history = (new LocationSlugHistoryModel())->findByOldSlug($slug);

        if ($history) {
            $target = $slugsModel->findFor($history->type, $history->entity_id);

            if ($target) {
                return $this->respond(['redirect' => $target->slug]);
            }
        }

        // A category "slug" is just its key (Config\Categories), not a row in
        // location_slugs — categories are reserved words in the slug
        // namespace (Config\LocationSlugs::$reservedWords), not part of it.
        if (config('Categories')->has($slug)) {
            return $this->respond(['type' => 'category', 'name' => $slug]);
        }

        return $this->failNotFound(lang('Locations.slugNotFound'));
    }

    private function resolveLegacyId(?string $type, int $legacyId, string $locale): ResponseInterface
    {
        if (!in_array($type, self::TYPES, true)) {
            return $this->failValidationErrors(lang('Locations.typeInvalid'));
        }

        $legacyRow = (new LocationLegacyIdsModel())
            ->where(['location_type' => $type, 'old_id' => $legacyId])
            ->first();

        $currentId = $legacyRow ? $legacyRow->new_id : $legacyId;
        $data      = $this->buildResolvedLocation($type, $currentId, $locale);

        if (!$data) {
            return $this->failNotFound(lang('Locations.slugNotFound'));
        }

        return $this->respond($data);
    }

    /**
     * @return array<string, mixed>|null null when the entity does not exist
     */
    private function buildResolvedLocation(string $type, int $id, string $locale): ?array
    {
        $models = $this->locationModels();
        $entity = $models[$type]->find($id);

        if (!$entity) {
            return null;
        }

        $slug        = (new LocationSlugsModel())->findFor($type, $id)?->slug;
        $placesCount = $this->placesCountFor($type, $id);
        $threshold   = config('LocationSlugs')->indexThreshold;

        return [
            'type'        => $type,
            'id'          => $id,
            'slug'        => $slug,
            'title'       => $entity->{"title_$locale"},
            'parents'     => $this->parentsChain($type, $entity, $locale, $models),
            'placesCount' => $placesCount,
            'indexable'   => $placesCount >= $threshold,
        ];
    }

    /**
     * Country → … → immediate parent, excluding the entity itself.
     *
     * @return array<int, array{type: string, id: int, slug: ?string, title: string}>
     */
    private function parentsChain(string $type, object $entity, string $locale, array $models): array
    {
        $parents = [];

        if ($type !== 'country' && !empty($entity->country_id)) {
            $country = $models['country']->find($entity->country_id);

            if ($country) {
                $parents[] = $this->locationRef('country', (int) $entity->country_id, $country, $locale);
            }
        }

        if (in_array($type, ['district', 'locality'], true) && !empty($entity->region_id)) {
            $region = $models['region']->find($entity->region_id);

            if ($region) {
                $parents[] = $this->locationRef('region', (int) $entity->region_id, $region, $locale);
            }
        }

        if ($type === 'locality' && !empty($entity->district_id)) {
            $district = $models['district']->find($entity->district_id);

            if ($district) {
                $parents[] = $this->locationRef('district', (int) $entity->district_id, $district, $locale);
            }
        }

        return $parents;
    }

    private function locationRef(string $type, int $id, object $entity, string $locale): array
    {
        return [
            'type'  => $type,
            'id'    => $id,
            'slug'  => (new LocationSlugsModel())->findFor($type, $id)?->slug,
            'title' => $entity->{"title_$locale"},
        ];
    }

    /**
     * @return array<int, array{type: string, id: int, slug: ?string, title: string, placesCount: int}>
     */
    private function fetchChildLevel(
        \CodeIgniter\Database\BaseConnection $db,
        string $childType,
        string $alias,
        string $parentColumn,
        int $parentId,
        string $locale,
        ?string $mustBeNullColumn = null
    ): array {
        $tables = [
            'country'  => 'location_countries',
            'region'   => 'location_regions',
            'district' => 'location_districts',
            'locality' => 'location_localities',
        ];
        $table        = $tables[$childType];
        $placesColumn = self::COLUMNS[$childType];

        $query = $db->table("{$table} {$alias}")
            ->select(
                "{$alias}.id, {$alias}.title_$locale as title, ls.slug,
                (SELECT COUNT(*) FROM places p WHERE p.{$placesColumn} = {$alias}.id AND p.deleted_at IS NULL) as placesCount"
            )
            ->join('location_slugs ls', "ls.type = '{$childType}' AND ls.entity_id = {$alias}.id", 'left')
            ->where("{$alias}.{$parentColumn}", $parentId);

        if ($mustBeNullColumn) {
            $query->where("{$alias}.{$mustBeNullColumn}", null);
        }

        // A child without places has no page (its landing 404s) and nothing to say:
        // never a link on the parent page
        $rows = $query->having('placesCount >', 0)->orderBy('placesCount', 'DESC')->get()->getResult();

        return array_map(static fn ($row) => [
            'type'        => $childType,
            'id'          => (int) $row->id,
            'slug'        => $row->slug,
            'title'       => $row->title,
            'placesCount' => (int) $row->placesCount,
        ], $rows);
    }

    /** @return array<string, LocationCountriesModel|LocationRegionsModel|LocationDistrictsModel|LocationLocalitiesModel> */
    private function locationModels(): array
    {
        return [
            'country'  => new LocationCountriesModel(),
            'region'   => new LocationRegionsModel(),
            'district' => new LocationDistrictsModel(),
            'locality' => new LocationLocalitiesModel(),
        ];
    }

    private function placesCountFor(string $type, int $id): int
    {
        return (int) Database::connect()
            ->table('places')
            ->where(self::COLUMNS[$type], $id)
            ->where('deleted_at IS NULL', null, false)
            ->countAllResults();
    }
}
