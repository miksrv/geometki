<?php

use CodeIgniter\Test\CIUnitTestCase;
use Config\Categories;

/**
 * Config\Categories is the server's whole knowledge of place categories (the
 * client holds the names and texts): the keys must be unique, URL-safe (they
 * are path segments of /places/{category}) and stable.
 *
 * @internal
 */
final class CategoriesConfigTest extends CIUnitTestCase
{
    public function testHoldsTheTwentyThreeUniqueKeys(): void
    {
        $names = (new Categories())->names;

        $this->assertCount(23, $names);
        $this->assertSame($names, array_values(array_unique($names)));
    }

    public function testKeysAreLowercaseSlugs(): void
    {
        foreach ((new Categories())->names as $name) {
            $this->assertMatchesRegularExpression('/^[a-z]+$/', $name);
        }
    }

    public function testHasChecksMembershipStrictly(): void
    {
        $config = new Categories();

        $this->assertTrue($config->has('waterfall'));
        $this->assertFalse($config->has('Waterfall'));
        $this->assertFalse($config->has('historic'));
        $this->assertFalse($config->has(null));
    }
}
