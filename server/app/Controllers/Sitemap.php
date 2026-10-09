<?php

namespace App\Controllers;

use App\Models\CollectionsModel;
use App\Models\LocationSlugsModel;
use App\Models\PlacesModel;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Database;

/**
 * Sitemap controller
 *
 * Returns the IDs and last-modified timestamps for all places, users and
 * collections, plus the indexable landing pages of features/20-location-seo-pages.md
 * (categories, locations, location×category pairs — "SEO-паттерны: Sitemap:
 * только индексируемые страницы"), consumed by the client to generate the
 * XML sitemap.
 *
 * @package App\Controllers
 */
class Sitemap extends ResourceController
{
    private const LOCATION_COLUMNS = [
        'country'  => 'country_id',
        'region'   => 'region_id',
        'district' => 'district_id',
        'locality' => 'locality_id',
    ];

    /**
     * Return all place and user IDs with their last-updated timestamps, plus
     * the indexable category/location/location×category landing pages.
     *
     * GET /sitemap
     *
     * @return ResponseInterface
     */
    public function index(): ResponseInterface
    {
        $placesModel      = new PlacesModel();
        $usersModel       = new UsersModel();
        $collectionsModel = new CollectionsModel();

        $places      = $placesModel->select('id, slug, updated_at as updated')->findAll();
        $users       = $usersModel->select('id, updated_at as updated')->findAll();
        $collections = $collectionsModel
            ->select('id, slug, updated_at as updated')
            ->where(['hidden' => 0, 'indexable' => 1])
            ->findAll();

        foreach ([...$places, ...$users, ...$collections] as $row) {
            if (!empty($row->updated)) {
                $row->updated = new \DateTime((string) $row->updated);
            }
        }

        return $this->respond([
            'places'             => $places,
            'users'              => $users,
            'collections'        => $collections,
            'categories'         => $this->indexableCategories(),
            'locations'          => $this->indexableLocations(),
            'locationCategories' => $this->indexableLocationCategories(),
        ]);
    }

    /**
     * Categories with at least indexThreshold places, site-wide.
     *
     * @return array<int, array{name: string, updated: \DateTime}>
     */
    private function indexableCategories(): array
    {
        $threshold = config('LocationSlugs')->indexThreshold;
        $rows = Database::connect()->table('places')
            ->select('category as name, COUNT(*) as count, MAX(updated_at) as updated')
            ->where('deleted_at IS NULL', null, false)
            ->groupBy('category')
            ->having('count >=', $threshold)
            ->get()->getResult();

        return array_map(static fn ($row) => [
            'name'    => $row->name,
            'updated' => new \DateTime($row->updated),
        ], $rows);
    }

    /**
     * Locations (any of the 4 levels) with at least indexThreshold places.
     *
     * @return array<int, array{type: string, id: int, slug: ?string, updated: \DateTime}>
     */
    private function indexableLocations(): array
    {
        $threshold = config('LocationSlugs')->indexThreshold;
        $db        = Database::connect();
        $result    = [];

        foreach (self::LOCATION_COLUMNS as $type => $column) {
            $rows = $db->table('places')
                ->select("{$column} as entity_id, COUNT(*) as count, MAX(updated_at) as updated")
                ->where("{$column} IS NOT NULL", null, false)
                ->where('deleted_at IS NULL', null, false)
                ->groupBy($column)
                ->having('count >=', $threshold)
                ->get()->getResult();

            if (empty($rows)) {
                continue;
            }

            $slugsByEntity = $this->slugsFor($type, array_column($rows, 'entity_id'));

            foreach ($rows as $row) {
                $result[] = [
                    'type'    => $type,
                    'id'      => (int) $row->entity_id,
                    'slug'    => $slugsByEntity[(int) $row->entity_id] ?? null,
                    'updated' => new \DateTime($row->updated),
                ];
            }
        }

        return $result;
    }

    /**
     * Location×category pairs with at least indexThreshold places — the
     * `/places/{location}/{category}` pages (stage 4 of
     * features/20-location-seo-pages.md). Across all 4 levels: the spec's own
     * distribution table only sizes these at region level, but the rule
     * (≥ indexThreshold places) applies identically at every level.
     *
     * @return array<int, array{type: string, id: int, slug: ?string, category: string, updated: \DateTime}>
     */
    private function indexableLocationCategories(): array
    {
        $threshold = config('LocationSlugs')->indexThreshold;
        $db        = Database::connect();
        $result    = [];

        foreach (self::LOCATION_COLUMNS as $type => $column) {
            $rows = $db->table('places')
                ->select("{$column} as entity_id, category, COUNT(*) as count, MAX(updated_at) as updated")
                ->where("{$column} IS NOT NULL", null, false)
                ->where('deleted_at IS NULL', null, false)
                ->groupBy([$column, 'category'])
                ->having('count >=', $threshold)
                ->get()->getResult();

            if (empty($rows)) {
                continue;
            }

            $slugsByEntity = $this->slugsFor($type, array_column($rows, 'entity_id'));

            foreach ($rows as $row) {
                $result[] = [
                    'type'     => $type,
                    'id'       => (int) $row->entity_id,
                    'slug'     => $slugsByEntity[(int) $row->entity_id] ?? null,
                    'category' => $row->category,
                    'updated'  => new \DateTime($row->updated),
                ];
            }
        }

        return $result;
    }

    /**
     * @param array<int, int|string> $entityIds
     * @return array<int, string> entity_id => slug
     */
    private function slugsFor(string $type, array $entityIds): array
    {
        $rows = (new LocationSlugsModel())
            ->select('entity_id, slug')
            ->where('type', $type)
            ->whereIn('entity_id', array_unique(array_map('intval', $entityIds)))
            ->findAll();

        $byEntity = [];
        foreach ($rows as $row) {
            $byEntity[(int) $row->entity_id] = $row->slug;
        }

        return $byEntity;
    }
}