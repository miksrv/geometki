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
 * User activity controller
 * Show all user activity such as places, photos and rating
 */
class Activity extends ResourceController
{

    protected $model;

    function __construct()
    {
        $this->model = new ActivityModel();
    }

    /**
     * List user activities
     * We group similar activities together
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
        $activityData  = $this->model->getActivityList($lastDate, $author, $place, min($limit, 40), $offset);

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

        // Remove the last object in the array if it may not be fully grouped
        if (count($groupedData) >= $limit) {
            array_pop($groupedData);
        }

        // Increasing the view counter
        if (!empty($activityIds)) {
            $this->model->incrementViews($activityIds);
        }

        return $this->respond(['items' => $groupedData]);
    }

    /**
     * Recursively add next activity items that can be grouped with the last item
     * @param array $activityData
     */
    protected function addNextActivityItems(array &$activityData): void
    {
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
            if ($this->shouldGroupActivities($lastItem, $nextItem)) {
                $activityData[] = $nextItem;
            } else {
                return;
            }
        }

        // Recursively call the function to add the following elements
        $this->addNextActivityItems($activityData);
    }

    /**
     * Determine if two activity items should be grouped together
     * @param object $lastItem
     * @param object $nextItem
     * @return bool
     */
    private function shouldGroupActivities($lastItem, $nextItem): bool
    {
        return (
            (!isset($lastItem->place) || $lastItem->place->id === $nextItem->place_id) &&
            $lastItem->user_id === $nextItem->user_id
            // (strtotime($lastItem->created) - strtotime($nextItem->created_at)) <= 60 * 60
        );
    }

    /**
     * Group similar activities together
     * Activities are grouped if they are of the same type, by the same user,
     * and optionally related to the same place within a certain time frame.
     *
     * @param array $activityData List of activity items to be grouped.
     * @param PlacesContent|null $placeContent Instance of PlacesContent for fetching place details.
     * @return array List of grouped activity items.
     */
    protected function groupSimilarActivities(array $activityData, PlacesContent $placeContent = null): array
    {
        $categoriesModel = new CategoryModel();
        $categoriesData  = $categoriesModel->findAll();

        $groupData = [];

        if (empty($activityData)) {
            return $groupData;
        }

        $lastGroupIndex = -1;
        foreach ($activityData as $item) {
            // $itemCreatedAt = strtotime($item->created_at);
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
                isset($groupData[$lastGroupIndex]->author) && $groupData[$lastGroupIndex]->author?->id === $item?->user_id
                // ($itemCreatedAt - strtotime($groupData[$lastGroupIndex]->created)) <= 60 * 60
            ) {
                // We are updating the group date to an earlier one.
                if (strtotime($item->created_at) < strtotime($groupData[$lastGroupIndex]->created)) {
                    $groupData[$lastGroupIndex]->created = $item->created_at;
                }

                // Determine the group type based on priority
                if ($item->type === 'place') {
                    $groupData[$lastGroupIndex]->type = 'place';
                } elseif ($item->type === 'edit' && $groupData[$lastGroupIndex]->type !== 'place') {
                    $groupData[$lastGroupIndex]->type = 'edit';
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
                $avatarLibrary = new AvatarLibrary();
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

            $groupData[]    = $currentGroup;
            $lastGroupIndex = array_key_last($groupData);
        }

        return array_values($groupData);
    }
}