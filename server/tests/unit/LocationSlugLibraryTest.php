<?php

use App\Libraries\LocationSlugLibrary;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for the pure, DB-free parts of App\Libraries\LocationSlugLibrary:
 * qualifySlug() (parent qualification) and claimSlug() (the full
 * clean-vs-qualified-vs-reserved decision, with an injected `isTaken`
 * predicate standing in for the location_slugs table).
 *
 * Pure PHP — no DB, no HTTP.
 *
 * @internal
 */
final class LocationSlugLibraryTest extends CIUnitTestCase
{
    // -------------------------------------------------------------------------
    // qualifySlug()
    // -------------------------------------------------------------------------

    public function testQualifiesWithTheParentSlug(): void
    {
        $this->assertSame(
            'parizh-chelyabinskaya-oblast',
            LocationSlugLibrary::qualifySlug('parizh', 'chelyabinskaya-oblast')
        );
    }

    public function testQualifiesADistrictWithItsRegion(): void
    {
        $this->assertSame(
            'sovetskiy-rayon-orenburgskaya-oblast',
            LocationSlugLibrary::qualifySlug('sovetskiy-rayon', 'orenburgskaya-oblast')
        );
    }

    public function testCollapsesRepeatedDashesAtTheJoin(): void
    {
        $this->assertSame('base-parent', LocationSlugLibrary::qualifySlug('base-', '-parent'));
    }

    public function testCutsToEightyCharsOnAWordBoundary(): void
    {
        $base   = 'a-very-long-base-slug-that-is-already-pretty-long-by-itself';
        $parent = 'and-an-equally-long-parent-slug-pushing-the-total-well-past-eighty';
        $result = LocationSlugLibrary::qualifySlug($base, $parent);

        $this->assertLessThanOrEqual(80, strlen($result));
        $this->assertNotSame('-', substr($result, -1)); // never ends with a dash
    }

    // -------------------------------------------------------------------------
    // claimSlug()
    // -------------------------------------------------------------------------

    private function isTakenFrom(array $takenSlugs): callable
    {
        return static fn (string $slug): bool => in_array($slug, $takenSlugs, true);
    }

    public function testCleanSlugIsClaimedWhenFree(): void
    {
        $result = LocationSlugLibrary::claimSlug('orenburg', [], [], $this->isTakenFrom([]), 1);

        $this->assertSame('orenburg', $result['slug']);
        $this->assertTrue($result['isPrimary']);
        $this->assertSame('clean', $result['method']);
    }

    public function testQualifiesWithTheParentWhenTheCleanSlugIsTaken(): void
    {
        $result = LocationSlugLibrary::claimSlug(
            'parizh',
            ['chelyabinskaya-oblast', 'rossiya'],
            [],
            $this->isTakenFrom(['parizh']),
            225
        );

        $this->assertSame('parizh-chelyabinskaya-oblast', $result['slug']);
        $this->assertFalse($result['isPrimary']);
        $this->assertSame('qualified', $result['method']);
    }

    public function testFallsBackToTheNextParentWhenTheFirstQualificationIsAlsoTaken(): void
    {
        $result = LocationSlugLibrary::claimSlug(
            'sovetskiy-rayon',
            ['tatarstan', 'rossiya'],
            [],
            $this->isTakenFrom(['sovetskiy-rayon', 'sovetskiy-rayon-tatarstan']),
            5
        );

        $this->assertSame('sovetskiy-rayon-tatarstan-rossiya', $result['slug']);
        $this->assertSame('qualified', $result['method']);
    }

    public function testReservedWordIsNeverClaimedClean(): void
    {
        $result = LocationSlugLibrary::claimSlug(
            'museum',
            ['orenburgskaya-oblast'],
            ['museum'],
            $this->isTakenFrom([]),
            10
        );

        $this->assertSame('museum-orenburgskaya-oblast', $result['slug']);
        $this->assertFalse($result['isPrimary']);
        $this->assertSame('qualified', $result['method']);
    }

    public function testFallsBackToAnIdSuffixWhenEveryQualificationIsExhausted(): void
    {
        $result = LocationSlugLibrary::claimSlug(
            'base',
            ['parent'],
            [],
            $this->isTakenFrom(['base', 'base-parent']),
            42
        );

        $this->assertSame('base-parent-l42', $result['slug']);
        $this->assertFalse($result['isPrimary']);
        $this->assertSame('fallback', $result['method']);
    }

    public function testNoParentsAndTakenCleanSlugFallsBackImmediately(): void
    {
        $result = LocationSlugLibrary::claimSlug('base', [], [], $this->isTakenFrom(['base']), 7);

        $this->assertSame('base-l7', $result['slug']);
        $this->assertSame('fallback', $result['method']);
    }

    public function testSlugStartingWithThirteenHexCharsIsReservedLikeAPlaceId(): void
    {
        // "abc0123456789" is 13 hex chars — the place id format
        // (App\Models\ApplicationBaseModel::generateId()) — so this slug
        // could be mistaken for a place URL ("/places/{id}-{slug}"). It must
        // be qualified PARENT-first: appending after it ("abc0123456789-...")
        // would still start with 13 hex characters and be reserved again.
        $result = LocationSlugLibrary::claimSlug(
            'abc0123456789',
            ['orenburgskaya-oblast'],
            [],
            $this->isTakenFrom([]),
            10
        );

        $this->assertSame('orenburgskaya-oblast-abc0123456789', $result['slug']);
        $this->assertSame(0, preg_match('/^[0-9a-f]{13}/i', $result['slug']));
        $this->assertFalse($result['isPrimary']);
        $this->assertSame('qualified', $result['method']);
    }

    public function testSlugThatOnlyStartsWithTwelveHexCharsIsNotReserved(): void
    {
        $result = LocationSlugLibrary::claimSlug('abc012345678-x', [], [], $this->isTakenFrom([]), 11);

        $this->assertSame('abc012345678-x', $result['slug']);
        $this->assertTrue($result['isPrimary']);
        $this->assertSame('clean', $result['method']);
    }

    public function testThirteenHexPrefixFollowedByMoreTextIsStillReserved(): void
    {
        // The rule is "starts with", not "is exactly" — a slug like a real
        // place-URL suffix must be reserved too, and qualified parent-first
        // for the same reason as the exact-13-chars case above.
        $result = LocationSlugLibrary::claimSlug(
            'abc0123456789-some-place',
            ['orenburgskaya-oblast'],
            [],
            $this->isTakenFrom([]),
            12
        );

        $this->assertSame('orenburgskaya-oblast-abc0123456789-some-place', $result['slug']);
        $this->assertSame(0, preg_match('/^[0-9a-f]{13}/i', $result['slug']));
        $this->assertFalse($result['isPrimary']);
    }

    public function testNullParentsInTheChainAreSkipped(): void
    {
        $result = LocationSlugLibrary::claimSlug(
            'parizh',
            [null, 'chelyabinskaya-oblast'],
            [],
            $this->isTakenFrom(['parizh']),
            225
        );

        $this->assertSame('parizh-chelyabinskaya-oblast', $result['slug']);
    }
}
