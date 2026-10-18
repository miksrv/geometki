<?php

use App\Libraries\GuestCache;
use CodeIgniter\Config\Factories;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\FeatureTestTrait;
use Config\GuestCache as GuestCacheConfig;

/**
 * GuestCacheFilter: a guest's public GET is answered from the cache the second time, a
 * signed-in user's or a session's never, and a write to public data clears the cache.
 *
 * @internal
 */
final class GuestCacheFilterTest extends CIUnitTestCase
{
    use FeatureTestTrait;

    private static int $calls = 0;
    private GuestCacheConfig $config;

    protected function setUp(): void
    {
        parent::setUp();

        self::$calls = 0;

        $this->config          = new GuestCacheConfig();
        $this->config->enabled = true;
        $this->config->path    = WRITEPATH . 'cache/guest-test-' . bin2hex(random_bytes(4)) . '/';
        Factories::injectMock('config', 'GuestCache', $this->config);

        $this->withRoutes([
            ['get', 'places', static fn () => service('response')->setJSON(['calls' => ++self::$calls])],
            ['get', 'places/missing', static fn () => service('response')->setStatusCode(404)->setJSON(['calls' => ++self::$calls])],
            ['get', 'notifications', static fn () => service('response')->setJSON(['calls' => ++self::$calls])],
            ['put', 'rating', static fn () => service('response')->setJSON(['ok' => true])],
            ['put', 'location', static fn () => service('response')->setJSON(['ok' => true])],
            ['post', 'places/(:alphanum)/views', static fn () => service('response')->setJSON(['ok' => true])],
            ['post', 'photos/upload/temporary', static fn () => service('response')->setJSON(['ok' => true])],
            ['get', 'users', static fn () => service('response')->setJSON(['calls' => ++self::$calls])],
        ]);
    }

    protected function tearDown(): void
    {
        $cache = new GuestCache($this->config);
        $cache->flush();
        $cache->sweep();
        Factories::reset('config');

        parent::tearDown();
    }

    private function calls(\CodeIgniter\Test\TestResponse $response): int
    {
        return json_decode($response->getJSON(), true)['calls'];
    }

    public function testAGuestGetsTheSecondAnswerFromTheCache(): void
    {
        $this->assertSame(1, $this->calls($this->get('places?sort=views')));

        $second = $this->get('places?sort=views');
        $this->assertSame(1, $this->calls($second));
        $this->assertSame('HIT', $second->response()->getHeaderLine('X-Guest-Cache'));

        // Another query is another answer
        $this->assertSame(2, $this->calls($this->get('places?sort=rating')));
    }

    public function testSignedInUsersAndSessionsAreNeverCached(): void
    {
        $this->withHeaders(['Authorization' => 'token'])->get('places');
        $this->assertSame(2, $this->calls($this->withHeaders(['Authorization' => 'token'])->get('places')));

        $this->assertSame(3, $this->calls($this->withHeaders(['Session' => 'abc'])->get('places')));
        $this->assertSame(4, $this->calls($this->withHeaders(['Session' => 'abc'])->get('places')));
    }

    public function testTheLocaleIsPartOfTheKey(): void
    {
        $this->withHeaders(['Locale' => 'ru'])->get('places');

        $this->assertSame(2, $this->calls($this->withHeaders(['Locale' => 'en'])->get('places')));
        $this->assertSame(1, $this->calls($this->withHeaders(['Locale' => 'ru'])->get('places')));
    }

    public function testOnlyTheListedGroupsAndSuccessfulAnswersAreCached(): void
    {
        $this->get('notifications');
        $this->assertSame(2, $this->calls($this->get('notifications')));

        $this->get('places/missing');
        $this->assertSame(4, $this->calls($this->get('places/missing')));
    }

    public function testAWriteToPublicDataClearsTheCache(): void
    {
        $this->get('places');
        $this->put('rating');

        $this->assertSame(2, $this->calls($this->get('places')));
    }

    public function testAPrivateWriteKeepsTheCache(): void
    {
        $this->get('places');
        $this->put('location');

        $this->assertSame(1, $this->calls($this->get('places')));
    }

    public function testAViewAndATemporaryPhotoKeepTheCache(): void
    {
        $this->get('places');
        $this->post('places/abc123/views');
        $this->post('photos/upload/temporary');

        $this->assertSame(1, $this->calls($this->get('places')));
    }

    public function testAnAnswerWithItsOwnTtlGoesStaleSooner(): void
    {
        $this->config->ttls = ['users' => 60];

        $this->get('users');
        $this->assertSame(1, $this->calls($this->get('users')));

        // An hour later: still within the common day, past the minute of `users`
        foreach (glob($this->config->path . '*.json') as $file) {
            touch($file, time() - HOUR);
        }

        $this->assertSame(2, $this->calls($this->get('users')));
    }

    public function testAClearedFolderIsSweptLater(): void
    {
        $this->get('places');
        $this->put('rating');

        $this->assertDirectoryDoesNotExist($this->config->path);
        $this->assertSame(1, (new GuestCache($this->config))->sweep());
        $this->assertSame([], glob(rtrim($this->config->path, '/') . '.cleared-*'));
    }

    public function testNothingIsCachedWhenTurnedOff(): void
    {
        $this->config->enabled = false;

        $this->get('places');
        $this->assertSame(2, $this->calls($this->get('places')));
    }
}
