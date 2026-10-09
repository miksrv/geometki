<?php

namespace App\Libraries;

use Config\LocationSlugs;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use RuntimeException;
use Throwable;

/**
 * Thin, rate-limited, retrying wrapper around two Nominatim endpoints:
 *  - /reverse (https://nominatim.org/release-docs/latest/api/Reverse/)
 *  - /details (https://nominatim.org/release-docs/latest/api/Details/)
 *
 * Used by App\Libraries\Geocoder for both the live single-place lookup and
 * `php spark locations:rebuild`'s bulk re-geocoding.
 *
 * Respects the Nominatim usage policy (operations.osmfoundation.org/policies/nominatim):
 * a valid User-Agent and at most one request per second, enforced here
 * regardless of how many callers share one instance (the very first request
 * an instance makes is never delayed — there is nothing to throttle against
 * yet). 429/5xx responses and transport failures are retried with
 * exponential backoff.
 *
 * The throttle/backoff sleep is injectable so tests run instantly.
 */
class NominatimClient
{
    private LocationSlugs $config;
    private Client $client;

    /** @var callable(float): void */
    private $sleeper;

    private float $lastRequestAt = 0.0;

    public function __construct(?LocationSlugs $config = null, ?Client $client = null, ?callable $sleeper = null)
    {
        $this->config = $config ?? config('LocationSlugs');
        $this->client = $client ?? new Client([
            'base_uri' => 'https://nominatim.openstreetmap.org/',
            'timeout'  => 15,
            'headers'  => ['User-Agent' => $this->config->userAgent],
        ]);
        $this->sleeper = $sleeper ?? static function (float $seconds): void {
            if ($seconds > 0) {
                usleep((int) ($seconds * 1_000_000));
            }
        };
    }

    /**
     * Reverse-geocodes coordinates. The matched feature is normally the
     * most specific one available (a road/building) when $zoom is omitted
     * — that is what Geocoder uses as the anchor for details(). $zoom
     * restricts the match to a specific admin level (see
     * Config\LocationSlugs::$reverseZoomByType) and is only used as a
     * fallback when details() does not cover a level.
     *
     * @param float    $lat
     * @param float    $lon
     * @param int|null $zoom
     * @param string   $lang accept-language, for the localized address breakdown
     * @return array|null Decoded jsonv2 response, or null when Nominatim found nothing for the point
     * @throws RuntimeException after exhausting retries on a transport/429/5xx failure
     */
    public function reverse(float $lat, float $lon, ?int $zoom = null, string $lang = 'ru'): ?array
    {
        $query = [
            'format'          => 'jsonv2',
            'lat'             => $lat,
            'lon'             => $lon,
            'namedetails'     => 1,
            'addressdetails'  => 1,
            'accept-language' => $lang,
        ];

        if ($zoom !== null) {
            $query['zoom'] = $zoom;
        }

        return $this->request('reverse', $query);
    }

    /**
     * The ancestor administrative hierarchy of one OSM object, each entry
     * with its own osm_type/osm_id/rank_address/localname — the piece a
     * plain reverse call cannot give (reverse only carries the osm id of
     * the matched feature itself, not of its ancestors). Verified live:
     * the "address" array is sorted most-specific-first by rank_address
     * (Nominatim's own normalized level scale, documented at
     * nominatim.org/release-docs/latest/customize/Ranking — e.g. 8 ≈ a
     * state/region, 12 ≈ a county/district — which is far more portable
     * across countries than raw OSM admin_level). The top-level "country"
     * entry never carries an osm_type/osm_id of its own (confirmed against
     * the live API); country identity relies on its ISO code instead — see
     * Geocoder::resolveCountry().
     *
     * Note entries' own osm_type is a single letter (N/W/R), unlike
     * reverse()'s full word — Geocoder::extractOsmType() normalizes both.
     *
     * @param string $osmType node|way|relation
     * @param int    $osmId
     * @param string $lang
     * @return array|null null when Nominatim has nothing for this object any more
     */
    public function details(string $osmType, int $osmId, string $lang = 'ru'): ?array
    {
        $code = match ($osmType) {
            'node'     => 'N',
            'way'      => 'W',
            'relation' => 'R',
            default    => null,
        };

        if ($code === null) {
            return null;
        }

        return $this->request('details', [
            'osmtype'         => $code,
            'osmid'           => $osmId,
            'addressdetails'  => 1,
            'format'          => 'json',
            'accept-language' => $lang,
        ]);
    }

    /**
     * @throws RuntimeException after exhausting retries
     */
    private function request(string $path, array $query): ?array
    {
        $attempt = 0;

        while (true) {
            $this->throttle();

            try {
                $response = $this->client->get($path, ['query' => $query]);
                $data     = json_decode((string) $response->getBody(), true);

                // A point/object with nothing to report answers 200 with {"error": "..."}
                if (!is_array($data) || isset($data['error'])) {
                    return null;
                }

                return $data;
            } catch (Throwable $e) {
                $status    = $e instanceof RequestException && $e->getResponse() ? $e->getResponse()->getStatusCode() : null;
                $retryable = $status === 429 || $status === null || $status >= 500;

                if (!$retryable || $attempt >= $this->config->maxRetries) {
                    throw new RuntimeException("Nominatim {$path} failed: " . $e->getMessage(), 0, $e);
                }

                ($this->sleeper)((float) ($this->config->retryBaseSeconds * (2 ** $attempt)));
                $attempt++;
            }
        }
    }

    /**
     * Blocks until at least throttleSeconds have passed since the previous
     * request made through this instance. lastRequestAt starts at 0.0 (the
     * Unix epoch), so the elapsed time on an instance's first call is
     * always far larger than throttleSeconds and it never waits.
     */
    private function throttle(): void
    {
        $elapsed = microtime(true) - $this->lastRequestAt;
        $wait    = $this->config->throttleSeconds - $elapsed;

        if ($wait > 0) {
            ($this->sleeper)($wait);
        }

        $this->lastRequestAt = microtime(true);
    }
}
