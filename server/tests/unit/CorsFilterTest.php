<?php

use App\Filters\CorsFilter;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\URI;
use CodeIgniter\HTTP\UserAgent;
use CodeIgniter\Test\CIUnitTestCase;
use Config\App;
use Config\Services;

/**
 * Unit tests for CorsFilter.
 *
 * The after() hook is a no-op. The before() hook sets CORS headers and
 * calls die() on OPTIONS requests — we only test the safe path here.
 *
 * @internal
 */
final class CorsFilterTest extends CIUnitTestCase
{
    public function testCorsFilterCanBeInstantiated(): void
    {
        $filter = new CorsFilter();

        $this->assertInstanceOf(CorsFilter::class, $filter);
    }

    public function testAfterMethodReturnsNull(): void
    {
        $filter   = new CorsFilter();
        $request  = Services::request();
        $response = Services::response();

        $result = $filter->after($request, $response, null);

        $this->assertNull($result);
    }

    public function testAfterMethodReturnsNullWithArguments(): void
    {
        $filter   = new CorsFilter();
        $request  = Services::request();
        $response = Services::response();

        $result = $filter->after($request, $response, ['some' => 'argument']);

        $this->assertNull($result);
    }

    public function testImplementsFilterInterface(): void
    {
        $filter = new CorsFilter();

        $this->assertInstanceOf(\CodeIgniter\Filters\FilterInterface::class, $filter);
    }
}
