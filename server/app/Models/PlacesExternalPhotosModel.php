<?php

namespace App\Models;

use CodeIgniter\I18n\Time;

/**
 * Model for the `places_external_photos` table: Wikimedia Commons and PastVu photos linked to places.
 *
 * The images stay on the source servers; the gallery of a place shows them together with
 * the uploaded photos (see Photos::list).
 *
 * @package App\Models
 */
class PlacesExternalPhotosModel extends ApplicationBaseModel
{
    public const SOURCE_WIKIMEDIA = 'wikimedia';
    public const SOURCE_PASTVU    = 'pastvu';

    public const SOURCES = [self::SOURCE_WIKIMEDIA, self::SOURCE_PASTVU];

    protected $table            = 'places_external_photos';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'place_id',
        'user_id',
        'source',
        'external_id',
        'lat',
        'lon',
        'title',
        'author',
        'license',
        'license_url',
        'year',
        'page_url',
        'full_url',
        'preview_url',
        'width',
        'height',
    ];

    protected $useTimestamps = false;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    /**
     * A linked photo in the shape of an uploaded one (ApiModel.Photo on the client),
     * with the source details in `external`
     *
     * @param array $row
     * @param string|null $placeTitle Title of the place, the same one the uploaded photos have
     * @return array
     */
    public static function formatAsPhoto(array $row, ?string $placeTitle = null): array
    {
        return [
            'id'       => $row['id'],
            'placeId'  => $row['place_id'],
            'title'    => $placeTitle ?: $row['title'],
            'full'     => $row['full_url'],
            'preview'  => $row['preview_url'],
            'width'    => $row['width'] ? (int) $row['width'] : null,
            'height'   => $row['height'] ? (int) $row['height'] : null,
            'created'  => Time::parse($row['created_at']),
            'external' => [
                'source'     => $row['source'],
                'externalId' => $row['external_id'],
                'title'      => $row['title'],
                'author'     => $row['author'],
                'license'    => $row['license'],
                'licenseUrl' => $row['license_url'],
                'year'       => $row['year'] ? (int) $row['year'] : null,
                'url'        => $row['page_url'],
            ],
        ];
    }
}
