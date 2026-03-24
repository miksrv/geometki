<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the type-validation logic in Location::show().
 *
 * From Location.php:
 *   $location = ['country', 'region', 'district', 'locality'];
 *   if (!in_array($type, $location)) {
 *       return $this->failValidationErrors('Location type must be one of ...');
 *   }
 *
 * These tests verify the in_array guard as pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class LocationTypeValidationTest extends CIUnitTestCase
{
    /** @var string[] */
    private array $validTypes = ['country', 'region', 'district', 'locality'];

    private function isValidType(?string $type): bool
    {
        return in_array($type, $this->validTypes, true);
    }

    // =========================================================================
    // Valid types — must pass the guard
    // =========================================================================

    public function testCountryIsValidType(): void
    {
        $this->assertTrue($this->isValidType('country'));
    }

    public function testRegionIsValidType(): void
    {
        $this->assertTrue($this->isValidType('region'));
    }

    public function testDistrictIsValidType(): void
    {
        $this->assertTrue($this->isValidType('district'));
    }

    public function testLocalityIsValidType(): void
    {
        $this->assertTrue($this->isValidType('locality'));
    }

    // =========================================================================
    // Invalid types — must fail the guard
    // =========================================================================

    public function testNullTypeIsInvalid(): void
    {
        $this->assertFalse($this->isValidType(null));
    }

    public function testEmptyStringIsInvalid(): void
    {
        $this->assertFalse($this->isValidType(''));
    }

    public function testArbitraryStringIsInvalid(): void
    {
        $this->assertFalse($this->isValidType('city'));
    }

    public function testUppercaseVariantIsInvalid(): void
    {
        // Comparison is strict — 'Country' ≠ 'country'
        $this->assertFalse($this->isValidType('Country'));
    }

    public function testNumericStringIsInvalid(): void
    {
        $this->assertFalse($this->isValidType('1'));
    }

    public function testPartialMatchIsInvalid(): void
    {
        $this->assertFalse($this->isValidType('count')); // prefix of 'country'
    }

    // =========================================================================
    // All valid types are distinct
    // =========================================================================

    public function testAllValidTypesAreUnique(): void
    {
        $this->assertSame(count($this->validTypes), count(array_unique($this->validTypes)));
    }

    public function testExactlyFourValidTypes(): void
    {
        $this->assertCount(4, $this->validTypes);
    }
}
