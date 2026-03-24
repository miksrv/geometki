<?php

use App\Libraries\AvatarLibrary;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for AvatarLibrary::buildPath().
 *
 * buildPath() is pure logic — no filesystem, no DB.
 *
 * @internal
 */
final class AvatarLibraryTest extends CIUnitTestCase
{
    private AvatarLibrary $library;

    protected function setUp(): void
    {
        parent::setUp();
        $this->library = new AvatarLibrary();
    }

    public function testBuildPathReturnsNullForEmptyFilename(): void
    {
        $this->assertNull($this->library->buildPath('user123', '', 'small'));
    }

    public function testBuildPathReturnsNullForNullFilename(): void
    {
        $this->assertNull($this->library->buildPath('user123', null, 'small'));
    }

    public function testBuildPathReturnsNullForEmptyUserId(): void
    {
        $this->assertNull($this->library->buildPath('', 'avatar.jpg', 'small'));
    }

    public function testBuildPathReturnsNullForNullUserId(): void
    {
        $this->assertNull($this->library->buildPath(null, 'avatar.jpg', 'small'));
    }

    public function testBuildPathReturnsNullForFilenameWithoutExtension(): void
    {
        // count(explode('.', 'avatarnoext')) === 1 — returns null
        $this->assertNull($this->library->buildPath('user123', 'avatarnoext', 'small'));
    }

    public function testBuildPathReturnsCorrectSmallPath(): void
    {
        $result = $this->library->buildPath('abc123', 'myphoto.jpg', 'small');

        $this->assertStringContainsString('abc123', $result);
        $this->assertStringContainsString('myphoto_small.jpg', $result);
    }

    public function testBuildPathReturnsCorrectMediumPath(): void
    {
        $result = $this->library->buildPath('abc123', 'myphoto.jpg', 'medium');

        $this->assertStringContainsString('abc123', $result);
        $this->assertStringContainsString('myphoto_medium.jpg', $result);
    }

    public function testBuildPathIncludesPathAvatarsConstant(): void
    {
        $result = $this->library->buildPath('uid1', 'photo.png', 'small');

        $this->assertStringStartsWith(PATH_AVATARS, $result);
    }

    public function testBuildPathPreservesExtension(): void
    {
        $result = $this->library->buildPath('uid1', 'photo.png', 'medium');

        $this->assertStringEndsWith('.png', $result);
    }

    public function testBuildPathWithDifferentUserIds(): void
    {
        $resultA = $this->library->buildPath('userA', 'photo.jpg', 'small');
        $resultB = $this->library->buildPath('userB', 'photo.jpg', 'small');

        $this->assertStringContainsString('userA', $resultA);
        $this->assertStringContainsString('userB', $resultB);
        $this->assertNotSame($resultA, $resultB);
    }

    public function testBuildPathFormatIsCorrect(): void
    {
        // Expected: PATH_AVATARS . $userId . '/' . $name . '_' . $size . '.' . $ext
        $userId   = 'testuser';
        $filename = 'myavatar.jpg';
        $size     = 'small';

        $expected = PATH_AVATARS . $userId . '/myavatar_small.jpg';
        $result   = $this->library->buildPath($userId, $filename, $size);

        $this->assertSame($expected, $result);
    }
}
