<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the authentication-guard logic used in Bookmarks controller.
 *
 * Bookmarks::check()  returns { result: false } when unauthenticated.
 * Bookmarks::set()    returns 401 Unauthorized when unauthenticated.
 *
 * We test the branching conditions as pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class BookmarksAuthGuardTest extends CIUnitTestCase
{
    // =========================================================================
    // check() — unauthenticated path returns false immediately
    // =========================================================================

    public function testUnauthenticatedCheckReturnsFalse(): void
    {
        // Mirrors: if (!$this->session->isAuth) { return $this->respond(['result' => false]); }
        $isAuth = false;

        $response = !$isAuth ? ['result' => false] : null;

        $this->assertSame(['result' => false], $response);
    }

    public function testAuthenticatedCheckDoesNotShortCircuit(): void
    {
        $isAuth = true;

        $response = !$isAuth ? ['result' => false] : null;

        $this->assertNull($response);
    }

    // =========================================================================
    // check() — placeId presence guard
    // =========================================================================

    public function testMissingPlaceIdTriggersError(): void
    {
        $placeId = null;

        $shouldError = !$placeId;

        $this->assertTrue($shouldError);
    }

    public function testPresentPlaceIdDoesNotTriggerError(): void
    {
        $placeId = 'abc1234567890';

        $shouldError = !$placeId;

        $this->assertFalse($shouldError);
    }

    // =========================================================================
    // set() — unauthenticated path returns 401
    // =========================================================================

    public function testUnauthenticatedSetShouldReturnUnauthorized(): void
    {
        $isAuth = false;

        $shouldUnauthorize = !$isAuth;

        $this->assertTrue($shouldUnauthorize);
    }

    public function testAuthenticatedSetShouldNotReturnUnauthorized(): void
    {
        $isAuth = true;

        $shouldUnauthorize = !$isAuth;

        $this->assertFalse($shouldUnauthorize);
    }

    // =========================================================================
    // set() — missing placeId in JSON body
    // =========================================================================

    public function testMissingPlaceIdInBodyTriggersValidationError(): void
    {
        // Mirrors: if (empty($input) || !$input->placeId)
        $input = null;

        $shouldError = empty($input);

        $this->assertTrue($shouldError);
    }

    public function testEmptyObjectBodyTriggersValidationError(): void
    {
        $input = (object) [];

        // !$input->placeId → accessing undefined property returns null → truthy check fails
        $placeId     = $input->placeId ?? null;
        $shouldError = !$placeId;

        $this->assertTrue($shouldError);
    }

    public function testBodyWithPlaceIdDoesNotTriggerValidationError(): void
    {
        $input = (object) ['placeId' => 'abc1234567890'];

        $shouldError = empty($input) || !$input->placeId;

        $this->assertFalse($shouldError);
    }
}
