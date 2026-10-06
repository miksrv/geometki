<?php

namespace App\Models;

use App\Entities\CollectionEntity;
use App\Libraries\CollectionIndexability;
use Config\Database;

/**
 * Model for the `collections` table.
 *
 * A collection is an author-curated, published-immediately list of places.
 * Indexability, places_count, slug, and the region/category "theme" are all
 * maintained by the Collections controller as places and content change.
 *
 * @package App\Models
 */
class CollectionsModel extends ApplicationBaseModel
{
    protected $table            = 'collections';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = CollectionEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected array $hiddenFields = ['deleted_at'];

    /** @var array<int, string> */
    protected $allowedFields = [
        'slug',
        'user_id',
        'title',
        'description',
        'meta_description',
        'title_en',
        'description_en',
        'region_id',
        'country_id',
        'category',
        'cover_place_id',
        'cover_photo_id',
        'hidden',
        'featured',
        'indexable',
        'places_count',
        'views',
        'saves',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules = [
        'title'    => 'required|string|max_length[120]',
        'slug'     => 'permit_empty|string|max_length[120]',
        'user_id'  => 'required|string|min_length[3]|max_length[40]',
        'category' => 'permit_empty|string|max_length[50]',
    ];

    protected $validationMessages = [];
    protected $skipValidation     = false;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
    protected $afterFind      = ['prepareOutput'];

    /**
     * Count collections (including soft-deleted) created by a user since a
     * given timestamp. Used to enforce the daily creation rate limit.
     *
     * @param string $userId
     * @param string $since  Y-m-d H:i:s
     * @return int
     */
    public function countCreatedSince(string $userId, string $since): int
    {
        return $this->withDeleted()
            ->where('user_id', $userId)
            ->where('created_at >=', $since)
            ->countAllResults();
    }

    /**
     * Re-count and persist places_count from the actual, non-deleted
     * membership rows. Returns the new count.
     *
     * @param string $collectionId
     * @return int
     */
    public function recalcPlacesCount(string $collectionId): int
    {
        $db    = Database::connect();
        $count = (int) $db->table('collections_places')
            ->join('places', 'places.id = collections_places.place_id')
            ->where('collections_places.collection_id', $collectionId)
            ->where('places.deleted_at IS NULL', null, false)
            ->countAllResults();

        $this->skipValidation(true)->update($collectionId, ['places_count' => $count]);

        return $count;
    }

    /**
     * Fill region_id and/or category from the most common value among the
     * collection's current places, but only when the field is still empty —
     * once an owner sets the theme explicitly it is never auto-overwritten.
     *
     * @param string $collectionId
     * @return void
     */
    public function autofillTheme(string $collectionId): void
    {
        $collection = $this->find($collectionId);

        if (!$collection) {
            return;
        }

        $updates = [];
        $db      = Database::connect();

        if (empty($collection->region_id)) {
            $row = $db->table('collections_places')
                ->select('places.region_id, COUNT(*) as cnt')
                ->join('places', 'places.id = collections_places.place_id')
                ->where('collections_places.collection_id', $collectionId)
                ->where('places.region_id IS NOT NULL', null, false)
                ->where('places.deleted_at IS NULL', null, false)
                ->groupBy('places.region_id')
                ->orderBy('cnt', 'DESC')
                ->get(1)
                ->getRow();

            if ($row) {
                $updates['region_id'] = $row->region_id;
            }
        }

        if (empty($collection->category)) {
            $row = $db->table('collections_places')
                ->select('places.category, COUNT(*) as cnt')
                ->join('places', 'places.id = collections_places.place_id')
                ->where('collections_places.collection_id', $collectionId)
                ->where('places.category IS NOT NULL', null, false)
                ->where('places.deleted_at IS NULL', null, false)
                ->groupBy('places.category')
                ->orderBy('cnt', 'DESC')
                ->get(1)
                ->getRow();

            if ($row) {
                $updates['category'] = $row->category;
            }
        }

        if ($updates) {
            $this->skipValidation(true)->update($collectionId, $updates);
        }
    }

    /**
     * Recompute and persist the indexable flag from the collection's own
     * current description, places_count, and hidden state. Self-contained
     * counterpart to Collections::recalcIndexable() (which takes explicit
     * values mid-request); used where only the collection ID is known, e.g.
     * after a place it contains is hard-deleted elsewhere (Places::delete()).
     *
     * @param string $collectionId
     * @return void
     */
    public function recalcIndexable(string $collectionId): void
    {
        $collection = $this->find($collectionId);

        if (!$collection) {
            return;
        }

        $indexable = CollectionIndexability::isIndexable(
            $collection->description,
            (int) $collection->places_count,
            (bool) $collection->hidden
        );

        $this->skipValidation(true)->update($collectionId, ['indexable' => (int) $indexable]);
    }

    /**
     * Apply the standard SELECT columns and LEFT JOINs used to format a
     * collection (author, region, category) for list/detail responses.
     *
     * @return static
     */
    public function applyListSelect(): static
    {
        $this->select(
            'collections.id, collections.slug, collections.user_id as owner_id, collections.title,
            collections.description, collections.meta_description, collections.region_id, collections.category,
            collections.cover_place_id, collections.cover_photo_id, collections.hidden, collections.featured,
            collections.indexable, collections.places_count, collections.views, collections.saves,
            collections.updated_at as updated, collections.created_at as created,
            users.id as user_id, users.name as user_name, users.avatar as user_avatar,
            location_regions.title_en as region_en, location_regions.title_ru as region_ru,
            category.title_en as category_en, category.title_ru as category_ru'
        )
        ->join('users', 'users.id = collections.user_id', 'left')
        ->join('location_regions', 'location_regions.id = collections.region_id', 'left')
        ->join('category', 'category.name = collections.category', 'left');

        return $this;
    }

    /**
     * Increment the views counter for a collection.
     *
     * @param string $id
     * @return void
     */
    public function incrementViews(string $id): void
    {
        $db = Database::connect();
        $db->query('UPDATE collections SET views = views + 1 WHERE id = ?', [$id]);
    }

    /**
     * Update only the updated_at timestamp without touching any other field.
     *
     * Needed after reorder/note changes, which only write to collections_places,
     * because updated_at is not in allowedFields.
     *
     * @param string $id
     * @return bool
     */
    public function touch(string $id): bool
    {
        return $this->db->table($this->table)
            ->where($this->primaryKey, $id)
            ->update(['updated_at' => date('Y-m-d H:i:s')]);
    }
}
