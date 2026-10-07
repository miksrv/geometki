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