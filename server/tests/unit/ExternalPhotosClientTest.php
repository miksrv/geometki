<?php

use App\Libraries\ExternalPhotosClient;
use CodeIgniter\Test\CIUnitTestCase;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;

/**
 * Unit tests for App\Libraries\ExternalPhotosClient — the details of a Wikimedia Commons or PastVu
 * photo taken from the source by its id. The HTTP calls are mocked, no network.
 *
 * @internal
 */
final class ExternalPhotosClientTest extends CIUnitTestCase
{
    private function client(array $responses): ExternalPhotosClient
    {
        return new ExternalPhotosClient(new Client(['handler' => HandlerStack::create(new MockHandler($responses))]));
    }

    public function testWikimediaPhotoIsParsed(): void
    {
        $body = json_encode(['query' => ['pages' => ['105096626' => [
            'pageid'      => 105096626,
            'ns'          => 6,
            'title'       => 'File:27611-Saint_Vigor-Sols.png',
            'coordinates' => [['lat' => 45.1, 'lon' => 1.2]],
            'imageinfo'   => [[
                'mediatype'      => 'BITMAP',
                'width'          => 3270,
                'height'         => 2598,
                'thumbwidth'     => 1280,
                'thumbheight'    => 1017,
                'url'            => 'https://upload.wikimedia.org/wikipedia/commons/d/d4/27611-Saint-Vigor-Sols.png?utm_source=x',
                'thumburl'       => 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/27611-Saint-Vigor-Sols.png/1280px-27611-Saint-Vigor-Sols.png?utm_source=x',
                'descriptionurl' => 'https://commons.wikimedia.org/wiki/File:27611-Saint-Vigor-Sols.png',
                'extmetadata'    => [
                    'Artist'           => ['value' => '<a href="//commons.wikimedia.org/wiki/User:Roland45">Roland45</a>'],
                    'LicenseShortName' => ['value' => 'CC BY-SA 4.0'],
                    'LicenseUrl'       => ['value' => 'https://creativecommons.org/licenses/by-sa/4.0'],
                    'DateTimeOriginal' => ['value' => '2021-05-09'],
                ],
            ]],
        ]]]]);

        $photo = $this->client([new Response(200, [], $body)])->fetch('wikimedia', '105096626');

        $this->assertSame('wikimedia', $photo['source']);
        $this->assertSame('105096626', $photo['external_id']);
        $this->assertSame('27611-Saint Vigor-Sols', $photo['title']);
        $this->assertSame('Roland45', $photo['author']);
        $this->assertSame('CC BY-SA 4.0', $photo['license']);
        $this->assertSame(2021, $photo['year']);
        $this->assertSame(45.1, $photo['lat']);
        $this->assertSame(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/27611-Saint-Vigor-Sols.png/1280px-27611-Saint-Vigor-Sols.png',
            $photo['full_url']
        );
        $this->assertSame(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/27611-Saint-Vigor-Sols.png/500px-27611-Saint-Vigor-Sols.png',
            $photo['preview_url']
        );
        $this->assertSame(1280, $photo['width']);
        $this->assertSame(1017, $photo['height']);
    }

    public function testWikimediaPageThatIsNotAFileIsNotLinked(): void
    {
        $body = json_encode(['query' => ['pages' => ['5' => ['pageid' => 5, 'ns' => 0, 'title' => 'Main Page']]]]);

        $this->assertNull($this->client([new Response(200, [], $body)])->fetch('wikimedia', '5'));
    }

    public function testWikimediaAudioFileIsNotLinked(): void
    {
        $body = json_encode(['query' => ['pages' => ['7' => [
            'pageid'    => 7,
            'ns'        => 6,
            'title'     => 'File:Anthem.ogg',
            'imageinfo' => [['mediatype' => 'AUDIO', 'url' => 'https://upload.wikimedia.org/a/Anthem.ogg']],
        ]]]]);

        $this->assertNull($this->client([new Response(200, [], $body)])->fetch('wikimedia', '7'));
    }

    public function testWikimediaLicenseLinkMustBeAWebLink(): void
    {
        $body = json_encode(['query' => ['pages' => ['8' => [
            'pageid'    => 8,
            'ns'        => 6,
            'title'     => 'File:A.jpg',
            'imageinfo' => [[
                'mediatype'   => 'BITMAP',
                'url'         => 'https://upload.wikimedia.org/a/A.jpg',
                'extmetadata' => ['LicenseUrl' => ['value' => 'javascript:alert(1)']],
            ]],
        ]]]]);

        $this->assertNull($this->client([new Response(200, [], $body)])->fetch('wikimedia', '8')['license_url']);
    }

    public function testPastvuPhotoIsParsed(): void
    {
        $body = json_encode(['result' => ['photo' => [
            'cid'   => 760729,
            'file'  => 'i/e/n/ien36rd3zgbt83806t.jpg',
            'title' => 'Демонстрация 14 апреля 1961 года',
            'geo'   => [55.75391, 37.620781],
            'year'  => 1961,
            'w'     => 1271,
            'h'     => 647,
            'user'  => ['login' => 'Romalk', 'disp' => 'Romalk'],
        ]]]);

        $photo = $this->client([new Response(200, [], $body)])->fetch('pastvu', '760729');

        $this->assertSame([
            'source'      => 'pastvu',
            'external_id' => '760729',
            'lat'         => 55.75391,
            'lon'         => 37.620781,
            'title'       => 'Демонстрация 14 апреля 1961 года',
            'author'      => 'Romalk',
            'license'     => null,
            'license_url' => null,
            'year'        => 1961,
            'page_url'    => 'https://pastvu.com/p/760729',
            'full_url'    => 'https://img.pastvu.com/a/i/e/n/ien36rd3zgbt83806t.jpg',
            'preview_url' => 'https://img.pastvu.com/h/i/e/n/ien36rd3zgbt83806t.jpg',
            'width'       => 1271,
            'height'      => 647,
        ], $photo);
    }

    public function testMissingPastvuPhotoIsNotLinked(): void
    {
        $body = json_encode(['type' => 'NotFoundError', 'code' => 'NO_SUCH_PHOTO']);

        $this->assertNull($this->client([new Response(200, [], $body)])->fetch('pastvu', '1'));
    }

    public function testUnknownSourceAndNonNumericIdsAreRejectedWithoutRequests(): void
    {
        $client = $this->client([]);

        $this->assertNull($client->fetch('flickr', '1'));
        $this->assertNull($client->fetch('pastvu', '1 OR 1=1'));
    }
}
