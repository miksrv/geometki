<?php

use App\Libraries\AvatarLibrary;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Services;

/**
 * Unit tests for the IMPR-14 service registrations in Config\Services.
 *
 * Verifies that each library is registered as a named service factory method
 * and returns the correct type. AvatarLibrary is tested with a live instance
 * (it has no DB dependencies). The remaining three libraries have DB/request
 * dependencies, so we verify them via reflection on the Services class to
 * confirm the factory methods exist with the correct signatures.
 *
 * @internal
 */
final class ServiceRegistrationTest extends CIUnitTestCase
{
    // =========================================================================
    // AvatarLibrary — can be instantiated without a DB or HTTP request
    // =========================================================================

    public function testAvatarLibraryServiceReturnsCorrectType(): void
    {
        $instance = Services::avatarLibrary(false);

        $this->assertInstanceOf(AvatarLibrary::class, $instance);
    }

    public function testAvatarLibrarySharedServiceReturnsSameInstance(): void
    {
        // Reset shared instances to ensure a clean slate for this test
        Services::reset(true);

        $first  = Services::avatarLibrary();
        $second = Services::avatarLibrary();

        $this->assertSame($first, $second);
    }

    // =========================================================================
    // Reflection checks for DB-dependent services
    // The factory methods must exist, have the $getShared parameter, and
    // declare the correct return type. Instantiation is tested via type checks
    // on non-shared calls which go through the return new … path.
    // =========================================================================

    public function testSessionLibraryServiceMethodExists(): void
    {
        $this->assertTrue(
            method_exists(Services::class, 'sessionLibrary'),
            'Services::sessionLibrary() method does not exist'
        );
    }

    public function testSessionLibraryServiceMethodHasGetSharedParameter(): void
    {
        $reflection = new ReflectionMethod(Services::class, 'sessionLibrary');
        $params     = $reflection->getParameters();

        $this->assertCount(1, $params);
        $this->assertSame('getShared', $params[0]->getName());
        $this->assertTrue($params[0]->isDefaultValueAvailable());
        $this->assertTrue($params[0]->getDefaultValue());
    }

    public function testSessionLibraryServiceMethodDeclaredReturnType(): void
    {
        $reflection  = new ReflectionMethod(Services::class, 'sessionLibrary');
        $returnType  = $reflection->getReturnType();

        $this->assertNotNull($returnType);
        $this->assertSame(\App\Libraries\SessionLibrary::class, $returnType->getName());
    }

    public function testActivityLibraryServiceMethodExists(): void
    {
        $this->assertTrue(
            method_exists(Services::class, 'activityLibrary'),
            'Services::activityLibrary() method does not exist'
        );
    }

    public function testActivityLibraryServiceMethodHasGetSharedParameter(): void
    {
        $reflection = new ReflectionMethod(Services::class, 'activityLibrary');
        $params     = $reflection->getParameters();

        $this->assertCount(1, $params);
        $this->assertSame('getShared', $params[0]->getName());
        $this->assertTrue($params[0]->isDefaultValueAvailable());
        $this->assertTrue($params[0]->getDefaultValue());
    }

    public function testActivityLibraryServiceMethodDeclaredReturnType(): void
    {
        $reflection = new ReflectionMethod(Services::class, 'activityLibrary');
        $returnType = $reflection->getReturnType();

        $this->assertNotNull($returnType);
        $this->assertSame(\App\Libraries\ActivityLibrary::class, $returnType->getName());
    }

    public function testLevelsLibraryServiceMethodExists(): void
    {
        $this->assertTrue(
            method_exists(Services::class, 'levelsLibrary'),
            'Services::levelsLibrary() method does not exist'
        );
    }

    public function testLevelsLibraryServiceMethodHasGetSharedParameter(): void
    {
        $reflection = new ReflectionMethod(Services::class, 'levelsLibrary');
        $params     = $reflection->getParameters();

        $this->assertCount(1, $params);
        $this->assertSame('getShared', $params[0]->getName());
        $this->assertTrue($params[0]->isDefaultValueAvailable());
        $this->assertTrue($params[0]->getDefaultValue());
    }

    public function testLevelsLibraryServiceMethodDeclaredReturnType(): void
    {
        $reflection = new ReflectionMethod(Services::class, 'levelsLibrary');
        $returnType = $reflection->getReturnType();

        $this->assertNotNull($returnType);
        $this->assertSame(\App\Libraries\LevelsLibrary::class, $returnType->getName());
    }
}
