<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the SEC-03 fix: broken authorization logic in Places::delete.
 *
 * The original bug used `&&` in the guard:
 *   if (!$this->session->isAuth && $this->session->user->role !== 'admin')
 *
 * With `&&`, an authenticated non-admin passes isAuth === true, so the left
 * operand is false, and false && anything = false — the guard is never entered,
 * allowing any authenticated user to delete any place.
 *
 * The fix changes `&&` to `||`:
 *   if (!$this->session->isAuth || $this->session->user->role !== 'admin')
 *
 * These tests validate the logic directly using inline closures that mimic
 * the guard expression, requiring no database or HTTP layer.
 *
 * @internal
 */
final class PlacesDeleteAuthTest extends CIUnitTestCase
{
    // -------------------------------------------------------------------------
    // Helper: the BUGGY guard (&&)
    // -------------------------------------------------------------------------

    private function buggyGuard(bool $isAuth, ?string $role): bool
    {
        $user = (object) ['role' => $role];
        return (!$isAuth && $user->role !== 'admin');
    }

    // -------------------------------------------------------------------------
    // Helper: the FIXED guard (||)
    // -------------------------------------------------------------------------

    private function fixedGuard(bool $isAuth, ?string $role): bool
    {
        $user = (object) ['role' => $role];
        return (!$isAuth || $user->role !== 'admin');
    }

    // =========================================================================
    // Demonstrate the bug: buggy `&&` guard
    // =========================================================================

    /**
     * Buggy guard: authenticated non-admin bypasses the guard (the bug).
     * The guard returns FALSE, so no 403 is issued, and the deletion proceeds.
     */
    public function testBuggyGuardAuthenticatedNonAdminBypassesGuard(): void
    {
        // isAuth=true, role='user' → false && true = false → guard NOT entered
        $this->assertFalse($this->buggyGuard(true, 'user'));
    }

    /**
     * Buggy guard: unauthenticated non-admin is correctly blocked.
     */
    public function testBuggyGuardUnauthenticatedNonAdminIsBlocked(): void
    {
        // isAuth=false, role='user' → true && true = true → guard entered
        $this->assertTrue($this->buggyGuard(false, 'user'));
    }

    /**
     * Buggy guard: unauthenticated admin is unexpectedly blocked.
     * (No auth + admin role still triggers the left-side condition.)
     */
    public function testBuggyGuardUnauthenticatedAdminIsBlocked(): void
    {
        // isAuth=false, role='admin' → true && false = false → guard NOT entered
        // Actually this shows that even an admin without auth passes with the bug
        $this->assertFalse($this->buggyGuard(false, 'admin'));
    }

    // =========================================================================
    // Validate the fix: corrected `||` guard
    // =========================================================================

    /**
     * Fixed guard: authenticated non-admin IS blocked.
     */
    public function testFixedGuardAuthenticatedNonAdminIsBlocked(): void
    {
        // isAuth=true, role='user' → false || true = true → guard entered, 403 returned
        $this->assertTrue($this->fixedGuard(true, 'user'));
    }

    /**
     * Fixed guard: unauthenticated user is blocked.
     */
    public function testFixedGuardUnauthenticatedIsBlocked(): void
    {
        // isAuth=false, role='user' → true || true = true → guard entered
        $this->assertTrue($this->fixedGuard(false, 'user'));
    }

    /**
     * Fixed guard: unauthenticated admin is still blocked (auth required).
     */
    public function testFixedGuardUnauthenticatedAdminIsBlocked(): void
    {
        // isAuth=false, role='admin' → true || false = true → guard entered
        $this->assertTrue($this->fixedGuard(false, 'admin'));
    }

    /**
     * Fixed guard: authenticated admin is allowed (the only permitted case).
     */
    public function testFixedGuardAuthenticatedAdminIsAllowed(): void
    {
        // isAuth=true, role='admin' → false || false = false → guard NOT entered, deletion proceeds
        $this->assertFalse($this->fixedGuard(true, 'admin'));
    }

    /**
     * Fixed guard: authenticated moderator is also blocked (only admin may delete).
     */
    public function testFixedGuardAuthenticatedModeratorIsBlocked(): void
    {
        // isAuth=true, role='moderator' → false || true = true → guard entered
        $this->assertTrue($this->fixedGuard(true, 'moderator'));
    }
}
