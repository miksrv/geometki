<?php

namespace App\Libraries;

use App\Models\PhotosModel;
use App\Models\PlacesExternalPhotosModel;
use App\Models\PlacesModel;
use Config\Services;
use GuzzleHttp\Client;
use Throwable;

/**
 * The place cover: cover.jpg and cover_preview.jpg in the place's photo directory, cut from an
 * uploaded photo or from a linked Wikimedia Commons / PastVu photo. A linked photo is downloaded
 * only for the cut and not kept; `places.cover_external_id` remembers it for the cover caption.
 */
class PlaceCoverLibrary
{
    /** The only hosts a linked photo is downloaded from: the links come from our own rows, still checked */
    private const SOURCE_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org', 'img.pastvu.com'];

    private const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;

    /** Linked photos tried when rebuilding a cover: each one may wait for a slow source */
    private const MAX_REBUILD_ATTEMPTS = 2;

    private const IMAGE_TYPES = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF];

    private Client $client;

    public function __construct(?Client $client = null)
    {
        $this->client = $client ?? new Client([
            'timeout' => 30,
            'headers' => ['User-Agent' => config('OsmCandidates')->userAgent],
        ]);
    }

    /**
     * Cut the cover from an image file.
     *
     * @param string $sourcePath
     * @param string $placeId
     * @param array{x: int, y: int, width: int, height: int}|null $crop The box in the image pixels; null — the centre
     * @return void
     */
    public function make(string $sourcePath, string $placeId, ?array $crop = null): void
    {
        $photoDir = UPLOAD_PHOTOS . $placeId . '/';

        if (!is_dir($photoDir)) {
            mkdir($photoDir, 0755, true);
        }

        if ($crop === null) {
            (new PhotoLibrary())->generateCover($sourcePath, $photoDir);
            return;
        }

        $image = Services::image('gd');
        $image->withFile($sourcePath)
            ->crop($crop['width'], $crop['height'], $crop['x'], $crop['y'])
            ->fit(PLACE_COVER_WIDTH, PLACE_COVER_HEIGHT)
            ->save($photoDir . 'cover.jpg');

        $image->withFile($sourcePath)
            ->fit(PLACE_COVER_PREVIEW_WIDTH, PLACE_COVER_PREVIEW_HEIGHT)
            ->save($photoDir . 'cover_preview.jpg');
    }

    /**
     * The crop box moved inside the image: the client rounds a box in percent, so it may stick
     * out by a pixel. A box bigger than the image does not fit at all.
     *
     * @param array{x: int, y: int, width: int, height: int} $crop
     * @param int $width
     * @param int $height
     * @return array{x: int, y: int, width: int, height: int}|null
     */
    public static function fitCrop(array $crop, int $width, int $height): ?array
    {
        if ($crop['width'] > $width || $crop['height'] > $height) {
            return null;
        }

        return [
            'x'      => max(0, min($crop['x'], $width - $crop['width'])),
            'y'      => max(0, min($crop['y'], $height - $crop['height'])),
            'width'  => $crop['width'],
            'height' => $crop['height'],
        ];
    }

    /**
     * Cut the cover from a linked photo and remember it as the cover source.
     *
     * The crop box is in the pixels of the downloaded file, which the client shows from the same
     * link: a PastVu file is a little taller than its size in the PastVu API (the signature strip).
     *
     * @param string $placeId
     * @param array $row A places_external_photos row
     * @param array{x: int, y: int, width: int, height: int}|null $crop
     * @return string|null A language key of the error, null on success
     */
    public function fromExternal(string $placeId, array $row, ?array $crop = null): ?string
    {
        $path = $this->download((string) $row['full_url']);

        if (!$path) {
            return 'Places.coverSourceUnavailable';
        }

        try {
            if ($crop) {
                [$width, $height] = getimagesize($path);

                $crop = self::fitCrop($crop, $width, $height);

                if (!$crop) {
                    return 'Places.coverExceedDimensions';
                }
            }

            $this->make($path, $placeId, $crop);
        } finally {
            PhotoLibrary::removeFile($path);
        }

        (new PlacesModel())->update($placeId, ['cover_external_id' => $row['id']]);

        return null;
    }

    /**
     * A new cover after its linked source photo was unlinked: from the newest uploaded photo,
     * otherwise from another linked photo that can be a cover, otherwise none.
     *
     * @param string $placeId
     * @return void
     */
    public function rebuild(string $placeId): void
    {
        $photoDir = UPLOAD_PHOTOS . $placeId . '/';

        PhotoLibrary::removeFile($photoDir . 'cover.jpg');
        PhotoLibrary::removeFile($photoDir . 'cover_preview.jpg');

        $placesModel = new PlacesModel();
        $placesModel->update($placeId, ['cover_external_id' => null]);

        $photo = (new PhotosModel())
            ->select('filename, extension')
            ->where('place_id', $placeId)
            ->orderBy('created_at', 'DESC')
            ->first();

        if ($photo && is_file($photoDir . $photo->filename . '.' . $photo->extension)) {
            $this->make($photoDir . $photo->filename . '.' . $photo->extension, $placeId);
            return;
        }

        $linked = (new PlacesExternalPhotosModel())
            ->where('place_id', $placeId)
            ->orderBy('created_at', 'DESC')
            ->findAll();

        $attempts = 0;

        foreach ($linked as $row) {
            if (!PlacesExternalPhotosModel::canBeCover($row)) {
                continue;
            }

            if ($this->fromExternal($placeId, $row) === null || ++$attempts >= self::MAX_REBUILD_ATTEMPTS) {
                return;
            }
        }
    }

    private static function isSourceUrl(string $url): bool
    {
        return parse_url($url, PHP_URL_SCHEME) === 'https'
            && in_array(parse_url($url, PHP_URL_HOST), self::SOURCE_HOSTS, true);
    }

    /**
     * Download a linked photo into a temporary file.
     *
     * @param string $url
     * @return string|null The file path, null when the link is not an image of a source host
     */
    private function download(string $url): ?string
    {
        if (!self::isSourceUrl($url)) {
            return null;
        }

        if (!is_dir(UPLOAD_TEMPORARY)) {
            mkdir(UPLOAD_TEMPORARY, 0755, true);
        }

        $path = UPLOAD_TEMPORARY . 'cover_' . bin2hex(random_bytes(8));

        try {
            $this->client->get($url, [
                'sink'            => $path,
                // A redirect is followed only to a source host as well
                'allow_redirects' => [
                    'max'         => 3,
                    'protocols'   => ['https'],
                    'on_redirect' => static function ($request, $response, $uri) {
                        if (!self::isSourceUrl((string) $uri)) {
                            throw new \RuntimeException('The linked photo redirects outside its source');
                        }
                    },
                ],
                'on_headers'      => static function ($response) {
                    if ((int) $response->getHeaderLine('Content-Length') > self::MAX_DOWNLOAD_BYTES) {
                        throw new \RuntimeException('The linked photo is too big');
                    }
                },
            ]);

            $info = @getimagesize($path);

            if (filesize($path) > self::MAX_DOWNLOAD_BYTES || !$info || !in_array($info[2], self::IMAGE_TYPES, true)) {
                PhotoLibrary::removeFile($path);
                return null;
            }

            return $path;
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            PhotoLibrary::removeFile($path);
            return null;
        }
    }
}
