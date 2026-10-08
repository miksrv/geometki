<?php

use App\Libraries\OsmSourcesClient;
use CodeIgniter\Test\CIUnitTestCase;
use Config\OsmCandidates;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;

/**
 * Unit tests for App\Libraries\OsmSourcesClient — the queries to the sources and the parsing
 * of their answers. The HTTP calls are mocked, no network.
 *
 * @internal
 */
final class OsmSourcesClientTest extends CIUnitTestCase
{
    private function client(array $responses): OsmSourcesClient
    {
        $handler = HandlerStack::create(new MockHandler($responses));

        return new OsmSourcesClient(new OsmCandidates(), new Client(['handler' => $handler]));
    }

    public function testWikidataQueryAsksTheTileWithTheConfiguredClasses(): void
    {
        $query = (new OsmSourcesClient(new OsmCandidates()))->buildWikidataQuery([51.1, 55.0, 51.2, 55.1]);

        $this->assertStringContainsString('"Point(55 51.1)"^^geo:wktLiteral', $query);
        $this->assertStringContainsString('"Point(55.1 51.2)"^^geo:wktLiteral', $query);
        $this->assertStringContainsString('wd:Q35509', $query);
        $this->assertStringContainsString('wdt:P1483', $query);
        $this->assertStringContainsString('wikibase:wikiGroup "wikipedia"', $query);
    }

    public function testWikidataItemsAreParsed(): void
    {
        $body = json_encode(['results' => ['bindings' => [
            [
                'item'      => ['value' => 'http://www.wikidata.org/entity/Q2132225'],
                'ru'        => ['value' => 'Развал (озеро)'],
                'point'     => ['value' => 'Point(55.0011 51.1492)'],
                'classes'   => ['value' => 'http://www.wikidata.org/entity/Q23397'],
                'photo'     => ['value' => 'http://commons.wikimedia.org/wiki/Special:FilePath/Salionka.jpg'],
                'wikis'     => ['value' => '3'],
                'ruArticle' => ['value' => 'https://ru.wikipedia.org/wiki/%D0%A0%D0%B0%D0%B7%D0%B2%D0%B0%D0%BB_(%D0%BE%D0%B7%D0%B5%D1%80%D0%BE)'],
            ],
            [
                'item'  => ['value' => 'http://www.wikidata.org/entity/Q999'],
                'point' => ['value' => 'Point(55.05 51.15)'],
                'code'  => ['value' => '5610009000'],
                'wikis' => ['value' => '0'],
            ],
        ]]]);

        $items = $this->client([new Response(200, [], $body)])->wikidataItems([51.1, 55.0, 51.2, 55.1]);

        $this->assertSame([
            'id'        => 'Q2132225',
            'label'     => 'Развал (озеро)',
            'lat'       => 51.1492,
            'lon'       => 55.0011,
            'classes'   => ['Q23397'],
            'image'     => 'Salionka.jpg',
            'heritage'  => null,
            'sitelinks' => 3,
            'article'   => 'Развал (озеро)',
        ], $items['Q2132225']);

        $this->assertNull($items['Q999']['label']);
        $this->assertSame('5610009000', $items['Q999']['heritage']);
        $this->assertSame([], $items['Q999']['classes']);
    }

    public function testWikidataFailureThrows(): void
    {
        $this->expectException(RuntimeException::class);

        $this->client([new Response(500)])->wikidataItems([51.1, 55.0, 51.2, 55.1]);
    }

    public function testCommonsPhotosKeepAuthorAndLicence(): void
    {
        $body = json_encode(['query' => ['pages' => [
            '1' => [
                'title'     => 'File:Salionka.jpg',
                'imageinfo' => [[
                    'thumburl'       => 'https://upload.wikimedia.org/x/Salionka.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo',
                    'descriptionurl' => 'https://commons.wikimedia.org/wiki/File:Salionka.jpg',
                    'extmetadata'    => [
                        'Artist'           => ['value' => '<a href="//commons.wikimedia.org/wiki/User:Kagul">Kagul</a>'],
                        'LicenseShortName' => ['value' => 'CC BY-SA 4.0'],
                        'LicenseUrl'       => ['value' => 'https://creativecommons.org/licenses/by-sa/4.0'],
                    ],
                ]],
            ],
            '-1' => ['title' => 'File:Missing.jpg', 'missing' => ''],
        ]]]);

        $photos = $this->client([new Response(200, [], $body)])->commonsPhotos(['Salionka.jpg', 'Missing.jpg']);

        $this->assertCount(1, $photos);
        $this->assertSame([
            'file'       => 'Salionka.jpg',
            'url'        => 'https://upload.wikimedia.org/x/Salionka.jpg',
            'page'       => 'https://commons.wikimedia.org/wiki/File:Salionka.jpg',
            'author'     => 'Kagul',
            'license'    => 'CC BY-SA 4.0',
            'licenseUrl' => 'https://creativecommons.org/licenses/by-sa/4.0',
        ], $photos['Salionka.jpg']);
    }

    public function testOverpassTimeoutRemarkIsAFailureAndTheNextServerIsAsked(): void
    {
        $timedOut = json_encode(['elements' => [], 'remark' => 'runtime error: Query timed out in "query" at line 1 after 26 seconds.']);
        $answer   = json_encode(['elements' => [['type' => 'node', 'id' => 1, 'tags' => ['natural' => 'peak']]]]);

        $elements = $this->client([new Response(200, [], $timedOut), new Response(200, [], $answer)])
            ->fetchElements([51.1, 55.0, 51.2, 55.1]);

        $this->assertSame(1, $elements[0]['id']);
    }

    public function testOverpassFailsWhenEveryServerTimesOut(): void
    {
        $timedOut = json_encode(['elements' => [], 'remark' => 'runtime error: Query timed out']);
        $servers  = count((new OsmCandidates())->overpassServers);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Query timed out');

        $this->client(array_fill(0, $servers, new Response(200, [], $timedOut)))->fetchElements([51.1, 55.0, 51.2, 55.1]);
    }

    public function testWikipediaFailureFailsTheTile(): void
    {
        $this->expectException(RuntimeException::class);

        $this->client([new Response(500)])->nearbyArticles([51.1, 55.0, 51.2, 55.1]);
    }

    public function testCommonsFailureFailsTheTile(): void
    {
        $this->expectException(RuntimeException::class);

        $this->client([new Response(500)])->commonsPhotos(['Salionka.jpg']);
    }
}
