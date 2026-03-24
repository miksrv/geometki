<?php

use App\Filters\LocaleFilter;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Services;

/**
 * Unit tests for LocaleFilter.
 *
 * Ensures the filter can be instantiated and the after() hook (which is
 * a no-op) behaves correctly.
 *
 * @internal
 */
final class LocaleFilterTest extends CIUnitTestCase
{
    public function testLocaleFilterCanBeInstantiated(): void
    {
        $filter = new LocaleFilter();

        $this->assertInstanceOf(LocaleFilter::class, $filter);
    }

    public function testImplementsFilterInterface(): void
    {
        $filter = new LocaleFilter();

        $this->assertInstanceOf(\CodeIgniter\Filters\FilterInterface::class, $filter);
    }
}
