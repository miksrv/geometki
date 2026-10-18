<?php

use App\Libraries\SitePages;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * SitePages: the paths a write marks are sent once, by the place's URL, and forgotten
 * when nothing is to be sent.
 *
 * @internal
 */
final class SitePagesTest extends CIUnitTestCase
{
    protected function tearDown(): void
    {
        SitePages::reset();

        parent::tearDown();
    }

    public function testAPlacePathIsTheClientUrl(): void
    {
        $this->assertSame('/places/abc-monument', SitePages::placePath('abc', 'monument'));
        $this->assertSame('/places/abc', SitePages::placePath('abc', null));
        $this->assertSame('/places/abc', SitePages::placePath('abc', ''));
    }

    public function testACollectionPathIsTheClientUrl(): void
    {
        $this->assertSame('/collections/c1-waterfalls', SitePages::collectionPath('c1', 'waterfalls'));
        $this->assertSame('/collections/c1', SitePages::collectionPath('c1', null));
    }

    public function testPathsAreTakenOnceWithoutDuplicates(): void
    {
        SitePages::path('/places/abc-old');
        SitePages::path('places/abc-old');

        $this->assertSame(['/places/abc-old'], SitePages::take());
        $this->assertSame([], SitePages::take());
    }

    public function testNothingIsSentWithoutASecret(): void
    {
        config('SitePages')->secret = '';
        SitePages::path('/places/abc');

        SitePages::send();

        $this->assertSame([], SitePages::take());
    }
}
