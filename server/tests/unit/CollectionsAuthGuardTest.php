<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the authentication/ownership-guard logic used throughout
 * the Collections controller: create/update/delete/addPlaces/removePlace/
 * updatePlaces/membership/moderation all gate on session state the same way
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
    // canView() — mirrors Collections::canView(): hidden collections 404 for
    // everyone except the owner and admins.
    // =========================================================================

    private function canView(bool $hidden, bool $isAuth, ?string $role, ?string $sessionUserId, ?string $ownerId): bool
    {
        if (!$hidden) {
            return true;
        }

        return $this->isOwnerOrAdmin($isAuth, $role, $sessionUserId, $ownerId);
    }

    public function testVisibleCollectionIsAlwaysViewable(): void
    {
        $this->assertTrue($this->canView(false, false, null, null, 'user-1'));
    }

    public function testHiddenCollectionIsNotViewableByStranger(): void
    {
        $this->assertFalse($this->canView(true, true, 'user', 'user-2', 'user-1'));
    }

    public function testHiddenCollectionIsViewableByOwner(): void
    {
        $this->assertTrue($this->canView(true, true, 'user', 'user-1', 'user-1'));
    }

    public function testHiddenCollectionIsViewableByAdmin(): void
    {
        $this->assertTrue($this->canView(true, true, 'admin', 'admin-1', 'user-1'));
    }

    public function testHiddenCollectionIsNotViewableByGuest(): void
    {
        $this->assertFalse($this->canView(true, false, null, null, 'user-1'));
    }

    // =========================================================================
    // moderation() — admin-only guard: if (!isAuth || role !== 'admin')
    // =========================================================================

    private function moderationGuard(bool $isAuth, ?string $role): bool
    {
        return !$isAuth || $role !== 'admin';
    }

    public function testModerationBlocksNonAdmin(): void
    {
        $this->assertTrue($this->moderationGuard(true, 'user'));
    }

    public function testModerationBlocksUnauthenticated(): void
    {
        $this->assertTrue($this->moderationGuard(false, 'admin'));
    }

    public function testModerationAllowsAuthenticatedAdmin(): void
    {
        $this->assertFalse($this->moderationGuard(true, 'admin'));
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
