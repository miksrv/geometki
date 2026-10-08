<?php

namespace App\Controllers;

use App\Libraries\ExternalPhotosClient;
use App\Libraries\OsmTiles;
use App\Libraries\PlacesContent;
use App\Libraries\SessionLibrary;
use App\Models\PlacesExternalPhotosModel;
use App\Models\PlacesModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Throwable;

/**
 * Wikimedia Commons and PastVu photos linked to places.
 *
 * The images are not downloaded: the gallery of a place shows them from the source servers
 * together with the uploaded photos (see Photos::list). Linking gives no experience
 * and is not shown in the activity feed.
 *
 * @package App\Controllers
 */
class ExternalPhotos extends ResourceController
{
    /** The biggest map area to look for the linked photos in, square degrees */
    private const MAX_BOUNDS_AREA = 1;
    private const MAX_BOUNDS_ITEMS = 1000;

    protected SessionLibrary $session;

    /** @var PlacesExternalPhotosModel */
    protected $model;

    public function __construct()
    {
        $this->model   = new PlacesExternalPhotosModel();
        $this->session = new SessionLibrary();
    }

    /**
     * Linked photos of a place, or the photos inside a map area linked to any place.
     *
     * GET /external-photos?place=:id — [{ id, source, externalId }]
     * GET /external-photos?bounds=south,west,north,east — [{ source, externalId, places: [{ id, title }] }]
     *
     * @return ResponseInterface
     */
    public function list(): ResponseInterface
    {
        $place = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS);

        if ($place) {
            $rows = $this->model
                ->select('id, source, external_id')
                ->where('place_id', $place)
                ->findAll();

            return $this->respond(['items' => array_map(static fn ($row) => [
                'id'         => $row['id'],
                'source'     => $row['source'],
                'externalId' => $row['external_id'],
            ], $rows)]);
        }

        $bounds = OsmTiles::parseBounds($this->request->getGet('bounds'));

        if (!$bounds) {
            return $this->failValidationErrors(lang('ExternalPhotos.invalidBounds'));
        }

        [$south, $west, $north, $east] = $bounds;

        if (($north - $south) * ($east - $west) > self::MAX_BOUNDS_AREA) {
            return $this->respond(['items' => []]);
        }

        // Places are soft deleted: the links of a deleted place stay in the table, but not on the map
        $rows = $this->model
            ->select('places_external_photos.source, places_external_photos.external_id, places_external_photos.place_id')
            ->join('places', 'places.id = places_external_photos.place_id')
            ->where('places.deleted_at', null)
            ->where('places_external_photos.lat >=', $south)
            ->where('places_external_photos.lat <=', $north)
            ->where('places_external_photos.lon >=', $west)
            ->where('places_external_photos.lon <=', $east)
            ->findAll(self::MAX_BOUNDS_ITEMS);

        $content = new PlacesContent();
        $content->translate(array_column($rows, 'place_id'));

        $items = [];

        foreach ($rows as $row) {
            $key = $row['source'] . ':' . $row['external_id'];

            $items[$key] ??= [
                'source'     => $row['source'],
                'externalId' => $row['external_id'],
                'places'     => [],
            ];

            $items[$key]['places'][] = ['id' => $row['place_id'], 'title' => $content->title($row['place_id'])];
        }

        return $this->respond(['items' => array_values($items)]);
    }

    /**
     * Link a photo to a place. The details are taken from the source by the photo id.
     *
     * POST /external-photos — auth required, body: { placeId, source, externalId }
     *
     * @return ResponseInterface
     */
    public function create(): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $input      = $this->request->getJSON();
        $placeId    = (string) ($input->placeId ?? '');
        $source     = (string) ($input->source ?? '');
        $externalId = (string) ($input->externalId ?? '');

        if (!$placeId || !$externalId || !in_array($source, PlacesExternalPhotosModel::SOURCES, true)) {
            return $this->failValidationErrors(lang('ExternalPhotos.invalidRequest'));
        }

        $place = (new PlacesModel())->select('id, lat, lon')->find($placeId);

        if (!$place) {
            return $this->failValidationErrors(lang('ExternalPhotos.placeNotFound'));
        }

        $exists = $this->model
            ->where(['place_id' => $placeId, 'source' => $source, 'external_id' => $externalId])
            ->first();

        if ($exists) {
            return $this->failResourceExists(lang('ExternalPhotos.alreadyLinked'));
        }

        $photo = (new ExternalPhotosClient())->fetch($source, $externalId);

        if (!$photo) {
            return $this->failNotFound(lang('ExternalPhotos.photoNotFound'));
        }

        try {
            $row = array_merge($photo, [
                'place_id' => $placeId,
                'user_id'  => $this->session->user?->id,
                // A file without a position is linked by the place, its position is the place one
                'lat'      => $photo['lat'] ?? $place->lat,
                'lon'      => $photo['lon'] ?? $place->lon,
            ]);

            // With DBDebug off a failed insert returns false instead of throwing: the same duplicate case
            if ($this->model->insert($row) === false) {
                return $this->failResourceExists(lang('ExternalPhotos.alreadyLinked'));
            }

            $saved = $this->model->find($this->model->getLastGeneratedId());

            $content = new PlacesContent();
            $content->translate([$placeId]);

            return $this->respondCreated(PlacesExternalPhotosModel::formatAsPhoto($saved, $content->title($placeId)));
        } catch (DatabaseException $e) {
            // Two requests for the same photo at once: the unique key lets only one of them in
            if ((int) $e->getCode() === 1062) {
                return $this->failResourceExists(lang('ExternalPhotos.alreadyLinked'));
            }

            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('ExternalPhotos.linkError'));
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('ExternalPhotos.linkError'));
        }
    }

    /**
     * Unlink a photo from a place: by the one who linked it, the place author or an admin.
     *
     * DELETE /external-photos/:id — auth required
     *
     * @param string|null $id
     * @return ResponseInterface
     */
    public function delete($id = null): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $row = $this->model->find($id);

        if (!$row) {
            return $this->failNotFound(lang('ExternalPhotos.linkNotFound'));
        }

        $place  = (new PlacesModel())->select('id, user_id')->find($row['place_id']);
        $userId = $this->session->user?->id;

        $allowed = $row['user_id'] === $userId
            || $place?->user_id === $userId
            || $this->session->user?->role === 'admin';

        if (!$allowed) {
            return $this->failForbidden(lang('ExternalPhotos.noAccessToUnlink'));
        }

        $this->model->delete($id);

        return $this->respondDeleted(['id' => $id]);
    }
}
