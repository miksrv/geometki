<?php

namespace App\Libraries;

use App\Models\PlacesExternalPhotosModel;
use GuzzleHttp\Client;
use Throwable;

/**
 * Details of a Wikimedia Commons or PastVu photo by its id: image links, size, author and licence.
 *
 * The client sends only the source and the id of a photo to link; everything that is shown
 * is taken from the source itself, so no one can link an arbitrary image or author through us.
 *
 * @package App\Libraries
 */
class ExternalPhotosClient
{
    private const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
    private const PASTVU_API    = 'https://api.pastvu.com/api2';
    private const PASTVU_IMAGES = 'https://img.pastvu.com';

    /**
     * Width of the copy shown in the lightbox and of the gallery tile. Commons makes thumbnails
     * of the standard widths only (250, 330, 500, 960, 1280…), any other one answers 400
     */
    private const FULL_WIDTH    = 1280;
    private const PREVIEW_WIDTH = 500;

    /** Commons media types that are pictures */
    public const IMAGE_MEDIA_TYPES = ['BITMAP', 'DRAWING'];

    private Client $client;

    public function __construct(?Client $client = null)
    {
        $this->client = $client ?? new Client([
            'timeout' => 15,
            'headers' => ['User-Agent' => config('OsmCandidates')->userAgent],
        ]);
    }

    /**
     * @param string $source wikimedia or pastvu
     * @param string $externalId Commons pageid or PastVu cid
     * @return array|null Row fields of places_external_photos, null when the photo is not found
     */
    public function fetch(string $source, string $externalId): ?array
    {
        if (!ctype_digit($externalId)) {
            return null;
        }

        try {
            return match ($source) {
                PlacesExternalPhotosModel::SOURCE_WIKIMEDIA => $this->fetchWikimedia($externalId),
                PlacesExternalPhotosModel::SOURCE_PASTVU    => $this->fetchPastvu($externalId),
                default                                     => null,
            };
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return null;
        }
    }

    private function fetchWikimedia(string $pageId): ?array
    {
        $response = $this->client->get(self::WIKIMEDIA_API, ['query' => [
            'action'              => 'query',
            'format'              => 'json',
            'pageids'             => $pageId,
            'prop'                => 'imageinfo|coordinates',
            'iiprop'              => 'url|size|mediatype|extmetadata',
            'iiurlwidth'          => self::FULL_WIDTH,
            'iiextmetadatafilter' => 'Artist|LicenseShortName|LicenseUrl|DateTimeOriginal',
        ]]);

        $data = json_decode((string) $response->getBody(), true);
        $page = $data['query']['pages'][$pageId] ?? null;
        $info = $page['imageinfo'][0] ?? null;

        // Namespace 6 is File: an article or a missing page has no image. Audio, video and documents
        // are files too, but not photos
        if (
            !$page || ($page['ns'] ?? null) !== 6 || !$info || empty($info['url']) ||
            !in_array($info['mediatype'] ?? null, self::IMAGE_MEDIA_TYPES, true)
        ) {
            return null;
        }

        $meta  = $info['extmetadata'] ?? [];
        $full  = self::stripQuery($info['thumburl'] ?? $info['url']);
        $width = isset($info['thumbwidth'], $info['width']) ? min($info['width'], $info['thumbwidth']) : ($info['width'] ?? null);

        $height = $width && !empty($info['width']) && !empty($info['height'])
            ? (int) round($width / $info['width'] * $info['height'])
            : null;

        $year = null;
        if (preg_match('/\b(1[89]\d\d|20\d\d)\b/', strip_tags($meta['DateTimeOriginal']['value'] ?? ''), $match)) {
            $year = (int) $match[1];
        }

        return [
            'source'      => PlacesExternalPhotosModel::SOURCE_WIKIMEDIA,
            'external_id' => $pageId,
            'lat'         => $page['coordinates'][0]['lat'] ?? null,
            'lon'         => $page['coordinates'][0]['lon'] ?? null,
            'title'       => self::limit(preg_replace('/\.[a-z0-9]+$/i', '', str_replace('_', ' ', preg_replace('/^File:/', '', $page['title'])))),
            'author'      => self::limit(self::plainText($meta['Artist']['value'] ?? '')),
            'license'     => self::limit($meta['LicenseShortName']['value'] ?? null, 100),
            // The page metadata is editable: only a web link becomes a link in the caption
            'license_url' => preg_match('#^https?://#i', $meta['LicenseUrl']['value'] ?? '')
                ? self::limit($meta['LicenseUrl']['value'], 500)
                : null,
            'year'        => $year,
            'page_url'    => $info['descriptionurl'] ?? ('https://commons.wikimedia.org/?curid=' . $pageId),
            'full_url'    => $full,
            // A thumbnail link holds its width as `<width>px-`, the original (a small file) has none
            'preview_url' => str_contains($full, '/thumb/')
                ? preg_replace('/\/\d+px-([^\/]+)$/', '/' . self::PREVIEW_WIDTH . 'px-$1', $full)
                : $full,
            'width'       => $width,
            'height'      => $height,
        ];
    }

    private function fetchPastvu(string $cid): ?array
    {
        $response = $this->client->get(self::PASTVU_API, ['query' => [
            'method' => 'photo.giveForPage',
            'params' => json_encode(['cid' => (int) $cid]),
        ]]);

        $data  = json_decode((string) $response->getBody(), true);
        $photo = $data['result']['photo'] ?? null;

        if (!$photo || empty($photo['file'])) {
            return null;
        }

        return [
            'source'      => PlacesExternalPhotosModel::SOURCE_PASTVU,
            'external_id' => (string) $photo['cid'],
            'lat'         => $photo['geo'][0] ?? null,
            'lon'         => $photo['geo'][1] ?? null,
            'title'       => self::limit($photo['title'] ?? null),
            // The author of the photo when it is known, otherwise the one who uploaded it
            'author'      => self::limit(self::plainText($photo['author'] ?? '') ?: ($photo['user']['disp'] ?? null)),
            'license'     => null,
            'license_url' => null,
            'year'        => !empty($photo['year']) ? (int) $photo['year'] : null,
            'page_url'    => 'https://pastvu.com/p/' . $photo['cid'],
            'full_url'    => self::PASTVU_IMAGES . '/a/' . $photo['file'],
            'preview_url' => self::PASTVU_IMAGES . '/h/' . $photo['file'],
            'width'       => $photo['w'] ?? null,
            'height'      => $photo['h'] ?? null,
        ];
    }

    private static function stripQuery(string $url): string
    {
        return explode('?', $url, 2)[0];
    }

    private static function plainText(string $html): string
    {
        return trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5)));
    }

    private static function limit(?string $value, int $length = 255): ?string
    {
        return $value === null || $value === '' ? null : mb_substr($value, 0, $length);
    }
}
