<?php

/**
 * Returns an array of latitude and longitude from the Image file
 * @param string $file
 * @return object|null :number |boolean
 */
function getPhotoLocation(string $file): ?object
{
    if (!is_file($file)) {
        return null;
    }

    // EXIF (and so GPS) is only read from JPEG and TIFF: on WebP and PNG exif_read_data()
    // warns "File not supported", which ended up in the error log on every such upload
    $type = @exif_imagetype($file);

    if (!in_array($type, [IMAGETYPE_JPEG, IMAGETYPE_TIFF_II, IMAGETYPE_TIFF_MM], true)) {
        return null;
    }

    try {
        $info = exif_read_data($file);

        if (!isset($info['GPSLatitude']) || !isset($info['GPSLongitude']) ||
            !isset($info['GPSLatitudeRef']) || !isset($info['GPSLongitudeRef']) ||
            !in_array($info['GPSLatitudeRef'], array('E', 'W', 'N', 'S')) || !in_array($info['GPSLongitudeRef'], array('E', 'W', 'N', 'S'))) {

            return null;
        }

        $GPSLatitudeRef = strtolower(trim($info['GPSLatitudeRef']));
        $GPSLongitudeRef = strtolower(trim($info['GPSLongitudeRef']));

        $lat_degrees_a = explode('/', $info['GPSLatitude'][0]);
        $lat_minutes_a = explode('/', $info['GPSLatitude'][1]);
        $lat_seconds_a = explode('/', $info['GPSLatitude'][2]);
        $lng_degrees_a = explode('/', $info['GPSLongitude'][0]);
        $lng_minutes_a = explode('/', $info['GPSLongitude'][1]);
        $lng_seconds_a = explode('/', $info['GPSLongitude'][2]);

        $lat_degrees = $lat_degrees_a[0] / $lat_degrees_a[1];
        $lat_minutes = $lat_minutes_a[0] / $lat_minutes_a[1];
        $lat_seconds = $lat_seconds_a[0] / $lat_seconds_a[1];
        $lng_degrees = $lng_degrees_a[0] / $lng_degrees_a[1];
        $lng_minutes = $lng_minutes_a[0] / $lng_minutes_a[1];
        $lng_seconds = $lng_seconds_a[0] / $lng_seconds_a[1];

        $lat = (float)$lat_degrees + ((($lat_minutes * 60) + ($lat_seconds)) / 3600);
        $lng = (float)$lng_degrees + ((($lng_minutes * 60) + ($lng_seconds)) / 3600);

        // if the latitude is South, make it negative.
        if ($GPSLatitudeRef == 's') {
            $lat *= -1;
        }

        // if the longitude is west, make it negative
        if ($GPSLongitudeRef == 'w') {
            $lng *= -1;
        }

        return (object)[
            'lat' => round($lat, 7),
            'lon' => round($lng, 7)
        ];
    } catch (Throwable $e) {
        // Throwable: an empty GPS fix (0/0 rationals) throws DivisionByZeroError, which is not an Exception
        log_message('error', '{exception}', ['exception' => $e]);

        return null;
    }
}

/**
 * The moment a photo was shot, from its EXIF (`DateTimeOriginal`, then `DateTimeDigitized`):
 * `Y-m-d H:i:s` in the camera's own clock (the EXIF keeps no time zone, and the day the person
 * was at the place is the day on their phone), or null when the file has none or it is not a date.
 * @param string $file
 * @return string|null
 */
function getPhotoTakenAt(string $file): ?string
{
    if (!is_file($file)) {
        return null;
    }

    $type = @exif_imagetype($file);

    if (!in_array($type, [IMAGETYPE_JPEG, IMAGETYPE_TIFF_II, IMAGETYPE_TIFF_MM], true)) {
        return null;
    }

    try {
        $info = @exif_read_data($file);

        foreach (['DateTimeOriginal', 'DateTimeDigitized'] as $key) {
            $value = is_array($info) && isset($info[$key]) && is_string($info[$key]) ? trim($info[$key]) : '';

            // "2026:11:02 14:05:33"; cameras without a clock write zeros
            if (!preg_match('/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/', $value, $match)) {
                continue;
            }

            [, $year, $month, $day, $hour, $minute, $second] = array_map('intval', $match);

            if (!checkdate($month, $day, $year) || $year < 1990 || $hour > 23 || $minute > 59 || $second > 59) {
                continue;
            }

            return sprintf('%04d-%02d-%02d %02d:%02d:%02d', $year, $month, $day, $hour, $minute, $second);
        }
    } catch (Throwable $e) {
        log_message('error', '{exception}', ['exception' => $e]);
    }

    return null;
}
