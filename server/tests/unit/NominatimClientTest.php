<?php

use App\Libraries\NominatimClient;
use CodeIgniter\Test\CIUnitTestCase;
use Config\LocationSlugs;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;

/**
 * Unit tests for App\Libraries\NominatimClient — the HTTP calls are mocked,
 * no network, and the throttle/backoff sleep is replaced with a no-op so
 * the tests run instantly despite exercising the retry loop.
 *
 * @internal
 */
final class NominatimClientTest extends CIUnitTestCase
{
    private function client(array $responses): NominatimClient
    {
        $handler = HandlerStack::create(new MockHandler($responses));

        return new NominatimClient(new LocationSlugs(), new Client(['handler' => $handler]), static function (float $seconds): void {
            // no-op — the real implementation's default sleeps, tests must not
        });
    }

    public function testParsesASuccessfulReverseResponse(): void
    {
        $body = json_encode([
            'osm_type'    => 'relation',
            'osm_id'      => 77669,
            'namedetails' => ['name' => 'Оренбургская область', 'name:ru' => 'Оренбургская область', 'name:en' => 'Orenburg Oblast'],
            'address'     => ['ISO3166-2-lvl4' => 'RU-ORE', 'country_code' => 'ru'],
        ]);

        $result = $this->client([new Response(200, [], $body)])->reverse(51.7682, 55.0968, 5);

        $this->assertSame('relation', $result['osm_type']);
        $this->assertSame(77669, $result['osm_id']);
        $this->assertSame('Orenburg Oblast', $result['namedetails']['name:en']);
        $this->assertSame('RU-ORE', $result['address']['ISO3166-2-lvl4']);
    }

    public function testNominatimErrorResponseReturnsNull(): void
    {
        $body = json_encode(['error' => 'Unable to geocode']);

        $result = $this->client([new Response(200, [], $body)])->reverse(0.0, 0.0, 3);

        $this->assertNull($result);
    }

    public function testRetriesOnceOn503ThenSucceeds(): void
    {
        $body = json_encode(['osm_type' => 'node', 'osm_id' => 1]);

        $result = $this->client([
            new Response(503),
            new Response(200, [], $body),
        ])->reverse(51.1, 55.0, 10);

        $this->assertSame(1, $result['osm_id']);
    }

    public function testRetriesOn429ThenSucceeds(): void
    {
        $body = json_encode(['osm_type' => 'way', 'osm_id' => 2]);

        $result = $this->client([
            new Response(429),
            new Response(200, [], $body),
        ])->reverse(51.1, 55.0, 8);

        $this->assertSame(2, $result['osm_id']);
    }

    public function testThrowsAfterExhaustingRetries(): void
    {
        $config = new LocationSlugs();
        $config->maxRetries = 2;

        $responses = array_fill(0, $config->maxRetries + 1, new Response(500));
        $handler   = HandlerStack::create(new MockHandler($responses));
        $client    = new NominatimClient($config, new Client(['handler' => $handler]), static function (float $s): void {});

        $this->expectException(RuntimeException::class);
        $client->reverse(51.1, 55.0, 3);
    }

    public function testDoesNotRetryOnA400(): void
    {
        $this->expectException(RuntimeException::class);

        $this->client([new Response(400)])->reverse(51.1, 55.0, 3);
    }

    // -------------------------------------------------------------------------
    // details()
    // -------------------------------------------------------------------------

    public function testParsesADetailsResponseWithAnAddressHierarchy(): void
    {
        $body = json_encode([
            'osm_type' => 'W',
            'osm_id'   => 38655105,
            'address'  => [
                ['osm_type' => 'W', 'osm_id' => 166155507, 'class' => 'place', 'type' => 'city', 'rank_address' => 16, 'localname' => 'Оренбург'],
                ['osm_type' => 'R', 'osm_id' => 1398615, 'class' => 'boundary', 'type' => 'administrative', 'rank_address' => 12, 'localname' => 'городской округ Оренбург'],
                ['osm_type' => 'R', 'osm_id' => 77669, 'class' => 'boundary', 'type' => 'administrative', 'rank_address' => 8, 'localname' => 'Оренбургская область'],
                ['class' => 'place', 'type' => 'country', 'rank_address' => 4, 'localname' => 'Россия'],
            ],
        ]);

        $result = $this->client([new Response(200, [], $body)])->details('way', 38655105);

        $this->assertCount(4, $result['address']);
        $this->assertSame(77669, $result['address'][2]['osm_id']);
    }

    public function testDetailsConvertsOsmTypeToTheSingleLetterCode(): void
    {
        $capturedQuery = null;
        $handler = HandlerStack::create(new MockHandler([
            static function (\Psr\Http\Message\RequestInterface $request) use (&$capturedQuery) {
                $capturedQuery = $request->getUri()->getQuery();

                return new Response(200, [], json_encode(['osm_type' => 'R', 'osm_id' => 77669, 'address' => []]));
            },
        ]));
        $client = new NominatimClient(new LocationSlugs(), new Client(['handler' => $handler]), static function (float $s): void {});

        $client->details('relation', 77669);

        $this->assertStringContainsString('osmtype=R', $capturedQuery);
        $this->assertStringContainsString('osmid=77669', $capturedQuery);
    }

    public function testDetailsReturnsNullForAnUnknownOsmType(): void
    {
        $this->assertNull($this->client([])->details('bogus', 1));
    }

    public function testDetailsErrorResponseReturnsNull(): void
    {
        $body = json_encode(['error' => 'Unknown osm_type W, osmid 1']);

        $result = $this->client([new Response(200, [], $body)])->details('way', 1);

        $this->assertNull($result);
    }

    // -------------------------------------------------------------------------
    // Throttle
    // -------------------------------------------------------------------------

    public function testDoesNotSleepBeforeAFreshInstancesFirstRequest(): void
    {
        $sleepCalls = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [], json_encode(['osm_type' => 'way', 'osm_id' => 1])),
        ]));
        $client = new NominatimClient(new LocationSlugs(), new Client(['handler' => $handler]), function (float $seconds) use (&$sleepCalls): void {
            $sleepCalls[] = $seconds;
        });

        $client->reverse(51.1, 55.0, 3);

        $this->assertSame([], $sleepCalls);
    }
}
