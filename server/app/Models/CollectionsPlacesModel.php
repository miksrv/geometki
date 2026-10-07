<?php

namespace App\Models;

use App\Entities\CollectionPlaceEntity;
use Config\Database;

/**
 * Model for the `collections_places` join table.
 *
 * There is no single-column primary key (the PK is the composite
 * (collection_id, place_id)), so membership, ordering, and note updates are
 * implemented as explicit query-builder methods rather than via find()/save().
 *
 * @package App\Models
 */
class CollectionsPlacesModel extends ApplicationBaseModel
{
    protected $table            = 'collections_places';
    protected $primaryKey       = 'collection_id';
    protected $useAutoIncrement = false;
    protected $returnType       = CollectionPlaceEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'collection_id',
        'place_id',
        'position',
        'note',
        'user_id',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = '';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    /**
     * Whether the given place already belongs to the collection.
     *
     * @param string $collectionId
     * @param string $placeId
     * @return bool
     */
    public function isMember(string $collectionId, string $placeId): bool
    {
        return (bool) $this->builder()
            ->where(['collection_id' => $collectionId, 'place_id' => $placeId])
            ->countAllResults();
    }

    /**
     * Return the set of place IDs from the given list that are already in
     * the collection.
     *
     * @param string $collectionId
     * @param array<int, string> $placeIds
     * @return array<int, string>
     */
    public function existingMembers(string $collectionId, array $placeIds): array
    {
        if (empty($placeIds)) {
            return [];
        }

        $rows = $this->builder()
            ->select('place_id')
            ->where('collection_id', $collectionId)
            ->whereIn('place_id', $placeIds)
            ->get()
            ->getResult();

        return array_map(static fn ($row) => $row->place_id, $rows);
    }

    /**
     * Next free position for appending a new place to a collection.
     *
     * @param string $collectionId
     * @return int
     */
    public function nextPosition(string $collectionId): int
    {
        $max = $this->builder()
            ->selectMax('position')
            ->where('collection_id', $collectionId)
            ->get()
            ->getRow();

        return $max && $max->position !== null ? ((int) $max->position) + 1 : 0;
    }

    /**
     * Append a place to a collection at the given position.
     *
     * @param string $collectionId
     * @param string $placeId
     * @param string|null $userId
     * @param int $position
     * @return bool
     */
    public function addPlace(string $collectionId, string $placeId, ?string $userId, int $position): bool
    {
        return (bool) $this->insert(new CollectionPlaceEntity([
            'collection_id' => $collectionId,
            'place_id'      => $placeId,
            'user_id'       => $userId,
            'position'      => $position,
        ]));
    }

    /**
     * Remove a place from a collection.
     *
     * @param string $collectionId
     * @param string $placeId
     * @return bool
     */
    public function removePlace(string $collectionId, string $placeId): bool
    {
        return $this->builder()
            ->where(['collection_id' => $collectionId, 'place_id' => $placeId])
            ->delete();
    }

    /**
     * Return the ordered, non-deleted place IDs of a collection.
     *
     * @param string $collectionId
     * @return array<int, string>
     */
    public function getOrderedPlaceIds(string $collectionId): array
    {
        $rows = $this->builder()
            ->select('collections_places.place_id')
            ->join('places', 'places.id = collections_places.place_id')
            ->where('collections_places.collection_id', $collectionId)
            ->where('places.deleted_at IS NULL', null, false)
            ->orderBy('collections_places.position', 'ASC')
            ->get()
            ->getResult();

        return array_map(static fn ($row) => $row->place_id, $rows);
    }

    /**
     * For each collection, the IDs of its first places (in the author's order) that
     * have a cover photo — at most $limit per collection. Feeds the cover mosaic of
     * collection cards, so the mosaic follows the membership and order automatically.
     *
     * @param array<int, string> $collectionIds
     * @param int $limit
     * @return array<string, array<int, string>> collectionId => [placeId, ...]
     */
    public function getCoverPlaceIds(array $collectionIds, int $limit = 4): array
    {
        if (empty($collectionIds)) {
            return [];
        }

        $rows = $this->builder()
            ->select('collections_places.collection_id, collections_places.place_id')
            ->join('places', 'places.id = collections_places.place_id')
            ->whereIn('collections_places.collection_id', $collectionIds)
            ->where('places.deleted_at IS NULL', null, false)
            ->where('places.photos >', 0)
            ->orderBy('collections_places.collection_id', 'ASC')
            ->orderBy('collections_places.position', 'ASC')
            ->get()
            ->getResult();

        $result = [];
        foreach ($rows as $row) {
            $result[$row->collection_id] ??= [];
            if (count($result[$row->collection_id]) < $limit) {
                $result[$row->collection_id][] = $row->place_id;
            }
        }

        return $result;
    }

    /**
     * Return a placeId => note map for a collection.
     *
     * @param string $collectionId
     * @return array<string, string|null>
     */
    public function getNotes(string $collectionId): array
    {
        $rows = $this->builder()
            ->select('place_id, note')
            ->where('collection_id', $collectionId)
            ->get()
            ->getResult();

        $notes = [];
        foreach ($rows as $row) {
            $notes[$row->place_id] = $row->note;
        }

        return $notes;
    }

    /**
     * Persist a new position for every place ID in order (0-based).
     * Caller is responsible for verifying the array is a permutation of the
     * collection's current membership.
     *
     * @param string $collectionId
     * @param array<int, string> $orderedPlaceIds
     * @return void
     */
    public function reorder(string $collectionId, array $orderedPlaceIds): void
    {
        $db = Database::connect();
        $db->transStart();

        foreach ($orderedPlaceIds as $position => $placeId) {
            $this->builder()
                ->where(['collection_id' => $collectionId, 'place_id' => $placeId])
                ->update(['position' => $position]);
        }

        $db->transComplete();
    }

    /**
     * Update the note for a single place in a collection.
     *
     * @param string $collectionId
     * @param string $placeId
     * @param string|null $note
     * @return bool
     */
    public function updateNote(string $collectionId, string $placeId, ?string $note): bool
    {
        return $this->builder()
            ->where(['collection_id' => $collectionId, 'place_id' => $placeId])
            ->update(['note' => $note]);
    }

    /**
     * Return the IDs of every collection that currently contains the given
     * place. Used before a place is hard-deleted (Places::delete()) so the
     * affected collections' places_count and indexable flag can be
     * recalculated once the membership row has been cascade-removed.
     *
     * @param string $placeId
     * @return array<int, string>
     */
    public function collectionIdsForPlace(string $placeId): array
    {
        $rows = $this->builder()
            ->select('collection_id')
            ->where('place_id', $placeId)
            ->get()
            ->getResult();

        return array_map(static fn ($row) => $row->collection_id, $rows);
    }

    /**
     * Count the collections (of the given user) that contain the given place,
     * or, when $userId is null, just check whether the place is a member of
     * the given collection.
     *
     * @param string $userId
     * @param string $placeId
     * @return array<int, string> Collection IDs owned by the user containing the place.
     */
    public function collectionIdsForUserAndPlace(string $userId, string $placeId): array
    {
        $rows = $this->builder()
            ->select('collections_places.collection_id')
            ->join('collections', 'collections.id = collections_places.collection_id')
            ->where('collections.user_id', $userId)
            ->where('collections_places.place_id', $placeId)
            ->get()
            ->getResult();

        return array_map(static fn ($row) => $row->collection_id, $rows);
    }
}
