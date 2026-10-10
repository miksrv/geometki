<?php

namespace App\Libraries;

class PlaceFormatterLibrary
{
    protected AvatarLibrary $avatarLibrary;

    public function __construct()
    {
        $this->avatarLibrary = new AvatarLibrary();
    }

    /**
     * Build the author array from raw user columns.
     *
     * @param object $row  Row that contains user_id, user_name, user_avatar.
     * @return array
     */
    public function formatAuthor(object $row): array
    {
        return [
            'id'     => $row->user_id,
            'name'   => $row->user_name,
            'avatar' => $this->avatarLibrary->buildPath($row->user_id, $row->user_avatar, 'small'),
        ];
    }

    /**
     * Build the nested address object from raw location columns.
     *
     * `slug` is the location's path segment for the landing pages
     * (features/20-location-seo-pages.md), null until
     * `php spark locations:rebuild`/the geocoder has assigned one.
     *
     * @param object $row
     * @param string $locale
     * @return object
     */
    public function formatAddress(object $row, string $locale): object
    {
        $address = (object) [];

        if (!empty($row->country_id)) {
            $address->country = [
                'id'   => (int) $row->country_id,
                'name' => $row->{"country_$locale"},
                'slug' => $row->country_slug ?? null,
            ];
        }

        if (!empty($row->region_id)) {
            $address->region = [
                'id'   => (int) $row->region_id,
                'name' => $row->{"region_$locale"},
                'slug' => $row->region_slug ?? null,
            ];
        }

        if (!empty($row->district_id)) {
            $address->district = [
                'id'   => (int) $row->district_id,
                'name' => $row->{"district_$locale"},
                'slug' => $row->district_slug ?? null,
            ];
        }

        if (!empty($row->locality_id)) {
            $address->locality = [
                'id'   => (int) $row->locality_id,
                'name' => $row->{"city_$locale"},
                'slug' => $row->city_slug ?? null,
            ];
        }

        return $address;
    }

    /**
     * Return cover paths if the cover file exists, otherwise null.
     *
     * @param string      $placeId
     * @param int         $photosCount
     * @param string|null $coverExternalId places.cover_external_id: the cover is cut from a linked photo
     * @return array|null
     */
    public function formatCover(string $placeId, int $photosCount, ?string $coverExternalId = null): ?array
    {
        if ($this->coverExists($placeId, $photosCount > 0 || !empty($coverExternalId))) {
            return [
                'full'    => PATH_PHOTOS . $placeId . '/cover.jpg',
                'preview' => PATH_PHOTOS . $placeId . '/cover_preview.jpg',
            ];
        }

        return null;
    }

    /**
     * Whether the place has a cover: something to cut it from (uploaded photos or a linked
     * cover photo, passed by the caller) and the cover file. With Config\Uploads::$verifyFiles
     * disabled (images served from another host) the file is assumed to exist.
     *
     * @param string $placeId
     * @param bool   $hasCoverSource The place has uploaded photos or places.cover_external_id
     * @return bool
     */
    public function coverExists(string $placeId, bool $hasCoverSource = true): bool
    {
        if (!$hasCoverSource) {
            return false;
        }

        if (!config('Uploads')->verifyFiles) {
            return true;
        }

        return file_exists(UPLOAD_PHOTOS . $placeId . '/cover.jpg');
    }

    /**
     * Round distance to 1 decimal place, or return null.
     *
     * @param mixed $raw
     * @return float|null
     */
    public function formatDistance($raw): ?float
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        return round((float) $raw, 1);
    }

    /**
     * Unset the raw DB columns that have been mapped to structured fields.
     *
     * @param object $row
     */
    public function cleanupFields(object $row): void
    {
        unset(
            $row->address_en, $row->address_ru,
            $row->user_id, $row->user_name, $row->user_avatar,
            $row->country_id, $row->country_en, $row->country_ru, $row->country_slug,
            $row->region_id, $row->region_en, $row->region_ru, $row->region_slug,
            $row->district_id, $row->district_en, $row->district_ru, $row->district_slug,
            $row->locality_id, $row->city_en, $row->city_ru, $row->city_slug,
            $row->created_at, $row->updated_at, $row->deleted_at,
            $row->visit_radius_m, $row->verification_exempt, $row->cover_external_id
        );
    }
}
