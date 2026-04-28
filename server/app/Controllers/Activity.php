<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\PlacesContent;
use App\Models\CategoryModel;
use App\Models\ActivityModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;

/**
 * Activity controller
 *
 * Exposes a feed of user activity events (place creation, photos, ratings,
 * comments, edits) grouped into consolidated timeline entries.
 *
 * @package App\Controllers
 */
class Activity extends ResourceController
{

    protected $model;

    public function __construct()
    {
        $this->model = new ActivityModel();
    }

    /**
     * Return a grouped activity feed.
     *
     * Accepts GET parameters: date, limit, offset, author, place.
     * Similar consecutive activity items are collapsed into a single group.
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $lastDate = $this->request->getGet('date', FILTER_SANITIZE_SPECIAL_CHARS);
        $limit    = abs($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 9);
        $offset   = abs($this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0);
        $author   = $this->request->getGet('author', FILTER_SANITIZE_SPECIAL_CHARS);
        $place    = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS);

        $placeContent  = new PlacesContent();
        $activityData  = $this->model->getActivityList($lastDate, $author, $place, min($limit + 1, 40), $offset);

        // Drop the extra lookahead row so we return at most $limit items
        if (count($activityData) > $limit) {
            array_pop($activityData);
        }

        $placesIds   = [];
        $activityIds = [];

        foreach ($activityData as $item) {
            if (!in_array($item->place_id, $placesIds)) {
                $placesIds[] = $item->place_id;
            }

            $activityIds[] = $item->id;
        }

        $placeContent->translate($placesIds, true);

        // Add more elements until they can be grouped together.
        $this->addNextActivityItems($activityData);

        // Now we group the data
        $groupedData = $this->groupSimilarActivities($activityData, $placeContent);


        // Increasing the view counter
        if (!empty($activityIds)) {
            $this->model->incrementViews($activityIds);
        }

        return $this->respond(['items' => $groupedData]);
    }

    /**
     * Recursively append activity items that can be grouped with the last item in the list.
     *
     * @param array $activityData Activity rows, passed by reference.
     *
     * @return void
     */
    protected function addNextActivityItems(array &$activityData, int $depth = 0): void
    {
        if (empty($activityData) || $depth >= 5) {
            return;
        }

        $lastItem  = end($activityData);
        $nextItems = $this->model->getNextActivityItems(
            array_column($activityData, 'id'),
            $lastItem->created_at,
            $lastItem->user_id,
            $lastItem->place_id
        );

        if (empty($nextItems)) {
            return;
        }

        foreach ($nextItems as $nextItem) {
            $lastItem = end($activityData);

            if ($this->shouldGroupActivities($lastItem, $nextItem)) {
                $activityData[] = $nextItem;
            } else {
                return;
            }
        }

        // Recursively call the function to add the following elements
        $this->addNextActivityItems($activityData, $depth + 1);
    }

    /**
     * Determine if two activity items should be collapsed into one group.
     *
     * @param object $lastItem The last item already in the current group.
     * @param object $nextItem The candidate item to potentially append.
     *
     * @return bool True when the two items belong in the same group.
     */
    private function shouldGroupActivities(object $lastItem, object $nextItem): bool
    {
        $timeDiff = abs($lastItem->created_at->getTimestamp() - $nextItem->created_at->getTimestamp());

        return (
            $lastItem->user_id === $nextItem->user_id &&
            $lastItem->place_id === $nextItem->place_id &&
            $timeDiff <= 600
        );
    }

    /**
     * Group similar activities into consolidated timeline entries.
     *
     * Activities are grouped when they share the same author and optionally the
     * same place. The group's type is resolved by priority: place > edit > photo.
     *
     * @param array             $activityData List of raw activity rows to collapse.
     * @param PlacesContent|null $placeContent PlacesContent instance for title/content lookup.
     *
     * @return array Grouped activity entries ready for the API response.
     */
    protected function groupSimilarActivities(array $activityData, ?PlacesContent $placeContent = null): array
    {
        $categoriesModel = new CategoryModel();
        $categoriesData  = $categoriesModel->findAll();

        $groupData = [];

        if (empty($activityData)) {
            return $groupData;
        }

        $avatarLibrary   = new AvatarLibrary();
        $lastGroupIndex  = -1;
        $groupCreatedTs  = [];
        foreach ($activityData as $item) {
            $itemCreatedAt = $item->created_at->getTimestamp();
            $photoPath = PATH_PHOTOS . $item->place_id . '/';
            $itemPhoto = $item->type === 'photo' && $item->filename ? [
                'full'      => $photoPath . $item->filename . '.' . $item->extension,
                'preview'   => $photoPath . $item->filename . '_preview.' . $item->extension,
                'width'     => PHOTO_PREVIEW_WIDTH,
                'height'    => PHOTO_PREVIEW_HEIGHT,
                'placeId'   => $item->place_id
            ] : null;

            // Check if we can group this element with the last group
            if (
                $lastGroupIndex !== -1 &&
                (!isset($groupData[$lastGroupIndex]->place) || $groupData[$lastGroupIndex]->place->id === $item->place_id) &&
                isset($groupData[$lastGroupIndex]->author) && $groupData[$lastGroupIndex]->author?->id === $item?->user_id &&
                abs($itemCreatedAt - $groupCreatedTs[$lastGroupIndex]) <= 600
            ) {
                // We are updating the group date to an earlier one.
                if ($itemCreatedAt < $groupCreatedTs[$lastGroupIndex]) {
                    $groupData[$lastGroupIndex]->created = $item->created_at;
                    $groupCreatedTs[$lastGroupIndex]     = $itemCreatedAt;
                }

                // Determine the group type based on priority: place > edit > cover > photo
                if ($item->type === 'place') {
                    $groupData[$lastGroupIndex]->type = 'place';
                } elseif ($item->type === 'edit' && $groupData[$lastGroupIndex]->type !== 'place') {
                    $groupData[$lastGroupIndex]->type = 'edit';
                } elseif ($item->type === 'cover' && !in_array($groupData[$lastGroupIndex]->type, ['place', 'edit'])) {
                    $groupData[$lastGroupIndex]->type = 'cover';
                } elseif ($item->type === 'photo' && $groupData[$lastGroupIndex]->type === 'photo') {
                    $groupData[$lastGroupIndex]->type = 'photo';
                }

                if ($itemPhoto) {
                    $groupData[$lastGroupIndex]->photos[] = $itemPhoto;
                }

                continue;
            }

            // Create a new group
            $currentGroup = (object) [
                'type'    => $item->type,
                'views'   => $item->views,
                'created' => $item->created_at,
                'photos'  => []
            ];

            if ($placeContent && $categoriesData) {
                $findCategory = array_search($item->category, array_column($categoriesData, 'name'));

                if ($findCategory !== false) {
                    $currentGroup->place = (object) [
                        'id'         => $item->place_id,
                        'title'      => $placeContent->get($item->place_id, 'title', $item->created_at),
                        'content'    => $placeContent->get($item->place_id, 'content', $item->created_at),
                        'difference' => (int) $placeContent->get($item->place_id, 'delta', $item->created_at),
                        'category'   => (object) [
                            'name'  => $categoriesData[$findCategory]->name,
                            'title' => $categoriesData[$findCategory]->title,
                        ]
                    ];
                }
            }

            if ($item->user_id) {
                $currentGroup->author = (object) [
                    'id'     => $item->user_id,
                    'name'   => $item->user_name,
                    'avatar' => $avatarLibrary->buildPath($item->user_id, $item->user_avatar, 'small'),
                ];
            }

            if ($item->type === 'photo') {
                $currentGroup->photos[] = $itemPhoto;
            }

            if ($item->type === 'rating') {
                $currentGroup->rating = (object) [
                    'value' => $item->value
                ];
            }

            if ($item->type === 'comment') {
                $currentGroup->comment = (object) [
                    'content' => $item->comment_text
                ];
            }

            $groupData[]                          = $currentGroup;
            $lastGroupIndex                       = array_key_last($groupData);
            $groupCreatedTs[$lastGroupIndex]      = $itemCreatedAt;
        }

        return array_values($groupData);
    }
}