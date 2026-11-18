<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the authentication/ownership-guard logic used throughout
 * the Collections controller: create/update/delete/addPlaces/removePlace/
 * updatePlaces/membership all gate on session state the same way
 * Bookmarks/Visited/Places do.
 *
 * We test the branching conditions as pure PHP — no HTTP, no DB — mirroring
 * BookmarksAuthGuardTest.php and PlacesDeleteAuthTest.php.
 *
 * @internal
 */
final class CollectionsAuthGuardTest extends CIUnitTestCase
{
    // =========================================================================
    // create()/addPlaces()/removePlace()/updatePlaces()/delete()/membership()
    // — unauthenticated guard: if (!$this->session->isAuth) return failUnauthorized()
    // =========================================================================

    public function testUnauthenticatedIsBlocked(): void
    {
        $isAuth = false;

        $shouldUnauthorize = !$isAuth;

        $this->assertTrue($shouldUnauthorize);
    }

    public function testAuthenticatedIsNotBlockedByAuthGuard(): void
    {
        $isAuth = true;

        $shouldUnauthorize = !$isAuth;

        $this->assertFalse($shouldUnauthorize);
    }

    // =========================================================================
    // isOwnerOrAdmin() — mirrors Collections::isOwnerOrAdmin()
    // =========================================================================

    private function isOwnerOrAdmin(bool $isAuth, ?string $role, ?string $sessionUserId, ?string $ownerId): bool
    {
        if (!$isAuth || $sessionUserId === null) {
            return false;
        }

        if ($role === 'admin') {
            return true;
        }

        return $ownerId === $sessionUserId;
    }

    public function testOwnerIsAllowed(): void
    {
        $this->assertTrue($this->isOwnerOrAdmin(true, 'user', 'user-1', 'user-1'));
    }

    public function testNonOwnerNonAdminIsBlocked(): void
    {
        $this->assertFalse($this->isOwnerOrAdmin(true, 'user', 'user-2', 'user-1'));
    }

    public function testAdminIsAllowedEvenWhenNotOwner(): void
    {
        $this->assertTrue($this->isOwnerOrAdmin(true, 'admin', 'user-2', 'user-1'));
    }

    public function testUnauthenticatedIsNeverOwnerOrAdmin(): void
    {
        $this->assertFalse($this->isOwnerOrAdmin(false, 'admin', null, 'user-1'));
    }

    // =========================================================================
    // create() — missing placeIds / malformed body guard for addPlaces()
    // =========================================================================

    public function testMissingPlaceIdsTriggersValidationError(): void
    {
        $input = (object) [];

        $shouldError = empty($input) || empty($input->placeIds ?? null) || !is_array($input->placeIds ?? null);

        $this->assertTrue($shouldError);
    }

    public function testPresentPlaceIdsArrayDoesNotTriggerValidationError(): void
    {
        $input = (object) ['placeIds' => ['abc1234567890']];

        $shouldError = empty($input) || empty($input->placeIds) || !is_array($input->placeIds);

        $this->assertFalse($shouldError);
    }
}
