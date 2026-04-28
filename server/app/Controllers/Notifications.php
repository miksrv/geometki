<?php

namespace App\Controllers;

use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Models\PlacesModel;
use App\Models\UsersNotificationsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use ReflectionException;

/**
 * Notifications controller
 *
 * Manages user notification feeds: recent unread notifications for snackbar
 * display, paginated full history, bulk clear, and automatic read-marking.
 *
 * @package App\Controllers
 */
class Notifications extends ResourceController
{
    private SessionLibrary $session;

    protected $model;

    public function __construct()
    {
        $this->session = new SessionLibrary();
        $this->model   = new UsersNotificationsModel();
    }

    /**
     * Return recent unread notifications (last 15 min) for snackbar display.
     *
     * GET /notifications/updates — auth required.
     * Also returns a count of older unread notifications.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function updates(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }
        $notifyData  = $this->model->getRecentUnread($this->session->user->id, 10);
        $notifyCount = $this->model->countOlderUnread($this->session->user->id);

        if (!$notifyData) {
            return $this->respond([
                'items' => [],
                'count' => $notifyCount
            ]);
        }

        return $this->respond([
            'items' => $this->formatNotifyList($notifyData),
            'count' => $notifyCount
        ]);
    }

    /**
     * Return a paginated list of all notifications for the authenticated user.
     *
     * GET /notifications — auth required.
     * Accepts query params: limit, offset.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $limit  = $this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?? 10;
        $offset = $this->request->getGet('offset', FILTER_SANITIZE_NUMBER_INT) ?? 0;

        $notifyData  = $this->model->getPaginatedByUser($this->session->user->id, (int) $limit, (int) $offset);
        $notifyCount = $this->model->countByUser($this->session->user->id);

        if (!$notifyData) {
            return $this->respond([
                'items' => [],
                'count' => $notifyCount
            ]);
        }

        return $this->respond([
            'items' => $this->formatNotifyList($notifyData),
            'count' => $notifyCount
        ]);
    }

    /**
     * Delete all notifications belonging to the authenticated user.
     *
     * DELETE /notifications/clear — auth required.
     *
     * @return ResponseInterface
     */
    public function clear(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $this->model
            ->where('users_notifications.user_id', $this->session->user->id)
            ->delete();

        return $this->respondDeleted([
            'items' => [],
            'count' => 0
        ]);
    }

    /**
     * Format a raw notification list into the API response shape.
     *
     * Enriches each entry with place title, cover image, and read status.
     * All unread notifications are immediately marked as read as a side-effect.
     *
     * @param array $notifyData Raw notification rows from the model.
     *
     * @throws ReflectionException
     *
     * @return array Formatted notification objects.
     */
    private function formatNotifyList(array $notifyData): array
    {
        if (empty($notifyData)) {
            return [];
        }

        $locale       = $this->request->getLocale();
        $placeContent = new PlacesContent(350);
        $placesData = [];
        $placesIds  = [];
        $result     = [];
        $unread     = [];

        // In the adjacent activity table we will collect ID place, if the current notification is about a change in content
        foreach ($notifyData as $notify) {
            if ($notify->place_id && $notify->type !== 'level' && $notify->type !== 'achievements') {
                $placesIds[] = $notify->place_id;
            }
        }

        // If we have collected IDs of places, we will get information about them from the database and download translations
        if ($placesIds) {
            $placesModel = new PlacesModel();
            $placesData  = $placesModel->select('id, photos')->whereIn('id', $placesIds)->findAll();
            $placeContent->translate($placesIds);
        }

        foreach ($notifyData as $notify) {
            // If the notification has not been read, add its ID to the array of unread notifications
            if (!$notify->read) {
                $unread[] = $notify->id;
            }

            $findPlace = array_search($notify->place_id, array_column($placesData, 'id'));
            $placeData = $findPlace !== false ? $placesData[$findPlace] : null;
            $meta = $notify->meta;
            if ($meta) {
                if ($notify->type === 'achievements') {
                    $meta = [
                        'title' => $locale === 'en' ? ($meta->title_en ?? '') : ($meta->title_ru ?? $meta->title_en ?? ''),
                        'image' => $meta->image ?? null,
                    ];
                } elseif ($notify->type === 'level') {
                    $meta = [
                        'title' => $locale === 'en' ? ($meta->title_en ?? '') : ($meta->title_ru ?? $meta->title_en ?? ''),
                        'level' => $meta->level ?? null,
                    ];
                }
            }

            $tempData  = [
                'id'       => $notify->id,
                'type'     => $notify->type,
                'activity' => $notify->activity_type,
                'meta'     => $meta
            ];

            if (isset($notify->created_at)) {
                $tempData['created'] = $notify->created_at;
            }

            if (isset($notify->read)) {
                $tempData['read'] = $notify->read;
            }

            if ($placeData && $placeData->id) {
                $tempData['place'] = [
                    'id'    => $placeData->id,
                    'title' => $placeContent->title($placeData->id),
                    'cover' => $placeData->photos && file_exists(UPLOAD_PHOTOS . $placeData->id . '/cover.jpg') ? [
                        'preview' => PATH_PHOTOS . $placeData->id . '/cover_preview.jpg',
                    ] : null
                ];
            }

            $result[] = $tempData;
        }

        // If our array of unread notifications is not empty, then we will mark all such notifications as read
        if (!empty($unread)) {
            $this->model->markRead($this->session->user->id, $unread);
        }

        return $result;
    }
}