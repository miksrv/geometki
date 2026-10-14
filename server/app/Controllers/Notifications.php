<?php

namespace App\Controllers;

use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Models\CollectionsModel;
use App\Models\PlacesModel;
use App\Models\UsersNotificationsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use JsonException;

/**
 * Notifications controller
 *
 * Manages user notification feeds: recent unread notifications for toasts, the list behind
 * the bell, marking as read and bulk clear. Reading never changes anything: notifications
 * become read only through PATCH /notifications/read, when the client has shown them.
 *
 * @package App\Controllers
 */
class Notifications extends ResourceController
{
    private const LIST_LIMIT_DEFAULT = 10;
    private const LIST_LIMIT_MAX     = 50;
    private const READ_IDS_MAX       = 100;

    private SessionLibrary $session;

    protected $model;

    public function __construct()
    {
        $this->session = new SessionLibrary();
        $this->model   = new UsersNotificationsModel();
    }

    /**
     * Return unread notifications of the toast window and the unread count for the badge.
     *
     * GET /notifications/updates — auth required.
     *
     * @return ResponseInterface
     */
    public function updates(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $userId = $this->session->user->id;

        return $this->respond([
            'items' => $this->formatNotifyList($this->model->getRecentUnread($userId, 10)),
            'count' => $this->model->countUnread($userId)
        ]);
    }

    /**
     * Return a page of the notification list of the authenticated user, newest first.
     *
     * GET /notifications/list — auth required.
     * Query params: limit (1–50, default 10), cursor (`next` of the previous page).
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $userId = $this->session->user->id;
        $limit  = (int) ($this->request->getGet('limit', FILTER_SANITIZE_NUMBER_INT) ?: self::LIST_LIMIT_DEFAULT);
        $limit  = max(1, min(self::LIST_LIMIT_MAX, $limit));
        $cursor = $this->request->getGet('cursor');
        $cursor = is_string($cursor) && ctype_alnum($cursor) ? $cursor : null;

        $items = $this->model->getPageByUser($userId, $limit, $cursor);

        return $this->respond([
            'items' => $this->formatNotifyList($items),
            'count' => $this->model->countByUser($userId),
            // A full page may have more after it; the client passes this back as `cursor`
            'next'  => count($items) === $limit ? end($items)->id : null
        ]);
    }

    /**
     * Mark notifications as read: the given ids, or all of them when no ids are passed.
     *
     * PATCH /notifications/read — auth required.
     * Body: { ids?: string[] } (at most 100). Responds with the new unread count.
     *
     * @return ResponseInterface
     */
    public function read(): ResponseInterface
    {
        if (!$this->session->isAuth || !$this->session->user?->id) {
            return $this->failUnauthorized();
        }

        $ids  = null;
        $body = trim((string) $this->request->getBody());

        if ($body !== '') {
            try {
                $input = json_decode($body, true, 4, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                return $this->failValidationErrors(lang('Notifications.invalidIds'));
            }

            if (is_array($input) && array_key_exists('ids', $input)) {
                $ids = $input['ids'];

                if (
                    !is_array($ids)
                    || count($ids) > self::READ_IDS_MAX
                    || array_filter($ids, static fn ($id) => !is_string($id) || !ctype_alnum($id))
                ) {
                    return $this->failValidationErrors(lang('Notifications.invalidIds'));
                }

                $ids = array_values(array_unique($ids));
            }
        }

        $userId = $this->session->user->id;

        $this->model->markRead($userId, $ids);

        return $this->respond(['count' => $this->model->countUnread($userId)]);
    }

    /**
     * Delete all notifications belonging to the authenticated user.
     *
     * DELETE /notifications — auth required.
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
     * Enriches each entry with the place (title, cover) or collection it is about.
     *
     * @param array $notifyData Raw notification rows from the model.
     *
     * @return array Formatted notification objects.
     */
    private function formatNotifyList(array $notifyData): array
    {
        if (empty($notifyData)) {
            return [];
        }

        $locale          = $this->request->getLocale();
        $placeContent    = new PlacesContent(350);
        $placesById      = [];
        $placesIds       = [];
        $collectionsById = [];
        $collectionsIds  = [];
        $result          = [];

        // Places and collections the notifications are about (level and achievement ones are about the user)
        foreach ($notifyData as $notify) {
            if ($notify->place_id && $notify->type !== 'level' && $notify->type !== 'achievements') {
                $placesIds[] = $notify->place_id;
            }

            if (!empty($notify->collection_id)) {
                $collectionsIds[] = $notify->collection_id;
            }
        }

        if ($placesIds) {
            $placesIds = array_values(array_unique($placesIds));
            $places    = (new PlacesModel())
                ->select('id, slug, photos, cover_external_id')
                ->whereIn('id', $placesIds)
                ->findAll();

            foreach ($places as $place) {
                $placesById[$place->id] = $place;
            }

            $placeContent->translate($placesIds);
        }

        if ($collectionsIds) {
            $collections = (new CollectionsModel())
                ->select('id, slug, title')
                ->whereIn('id', array_values(array_unique($collectionsIds)))
                ->findAll();

            foreach ($collections as $collection) {
                $collectionsById[$collection->id] = $collection;
            }
        }

        $formatter = new PlaceFormatterLibrary();

        foreach ($notifyData as $notify) {
            $placeData      = $placesById[$notify->place_id ?? ''] ?? null;
            $collectionData = $collectionsById[$notify->collection_id ?? ''] ?? null;

            $meta = $notify->meta ?: null;
            if ($meta && ($notify->type === 'achievements' || $notify->type === 'level')) {
                $title = $locale === 'en' ? ($meta->title_en ?? '') : ($meta->title_ru ?? $meta->title_en ?? '');

                $meta = $notify->type === 'achievements'
                    ? ['title' => $title, 'image' => $meta->image ?? null]
                    : ['title' => $title, 'level' => $meta->level ?? null];
            }

            $tempData = [
                'id'       => $notify->id,
                'type'     => $notify->type,
                'activity' => $notify->activity_type,
                'meta'     => $meta,
                'read'     => (bool) $notify->read,
            ];

            if (isset($notify->created_at)) {
                $tempData['created'] = $notify->created_at;
            }

            if ($placeData) {
                $cover = $formatter->formatCover($placeData->id, (int) $placeData->photos, $placeData->cover_external_id);

                $tempData['place'] = [
                    'id'    => $placeData->id,
                    'slug'  => $placeData->slug,
                    'title' => $placeContent->title($placeData->id),
                    'cover' => $cover ? ['preview' => $cover['preview']] : null
                ];
            }

            if ($collectionData) {
                $tempData['collection'] = [
                    'id'    => $collectionData->id,
                    'slug'  => $collectionData->slug,
                    'title' => $collectionData->title,
                ];
            }

            $result[] = $tempData;
        }

        return $result;
    }
}
