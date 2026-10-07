<?php

use App\Libraries\PhotoLibrary;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for PhotoLibrary: the stored file name pattern and processFile() on real
 * GD-generated images in a temporary directory.
 *
 * @internal
 */
final class PhotoLibraryTest extends CIUnitTestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        if (!function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD is not available');
        }

        $this->dir = sys_get_temp_dir() . '/photo-library-test-' . uniqid() . '/';
        mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        if (isset($this->dir) && is_dir($this->dir)) {
            array_map('unlink', glob($this->dir . '*'));
            rmdir($this->dir);
        }

        parent::tearDown();
    }

    private function makeJpeg(string $name, int $width, int $height): string
    {
        $path  = $this->dir . $name;
        $image = imagecreatetruecolor($width, $height);
        imagejpeg($image, $path);
        imagedestroy($image);

        return $path;
    }

    public function testFilenamePatternAcceptsStoredNames(): void
    {
        $this->assertSame(1, preg_match(PhotoLibrary::FILENAME_PATTERN, '1696000000_0a1b2c3d4e5f6a7b8c9d.jpg'));
        $this->assertSame(1, preg_match(PhotoLibrary::FILENAME_PATTERN, '1696000000_abc.webp'));
        $this->assertSame(1, preg_match(PhotoLibrary::FILENAME_PATTERN, '1696000000_abc.jpe'));
    }

    public function testFilenamePatternRejectsPaths(): void
    {
        $this->assertSame(0, preg_match(PhotoLibrary::FILENAME_PATTERN, '../places/abc/1696_abc.jpg'));
        $this->assertSame(0, preg_match(PhotoLibrary::FILENAME_PATTERN, 'sub/1696_abc.jpg'));
        $this->assertSame(0, preg_match(PhotoLibrary::FILENAME_PATTERN, '1696_abc.php'));
        $this->assertSame(0, preg_match(PhotoLibrary::FILENAME_PATTERN, '1696_abc.jpg.php'));
    }

    public function testProcessFileKeepsPortraitProportionsAndCreatesPreview(): void
    {
        $source = $this->makeJpeg('1696_portrait.jpg', 300, 600);

        $result = (new PhotoLibrary())->processFile($source, $this->dir);

        $this->assertSame(300, $result->width);
        $this->assertSame(600, $result->height);
        $this->assertSame([300, 600], array_slice(getimagesize($source), 0, 2));
        $this->assertFileExists($this->dir . '1696_portrait_preview.jpg');
        $this->assertNull($result->coordinates);
        $this->assertGreaterThan(0, $result->filesize);
    }

    public function testProcessFileCreatesCoverWhenAsked(): void
    {
        $source = $this->makeJpeg('1696_cover.jpg', 800, 400);

        (new PhotoLibrary())->processFile($source, $this->dir, true);

        $this->assertFileExists($this->dir . 'cover.jpg');
        $this->assertFileExists($this->dir . 'cover_preview.jpg');
    }

    public function testRemoveFileIgnoresMissingFiles(): void
    {
        PhotoLibrary::removeFile($this->dir . 'missing.jpg');

        $path = $this->makeJpeg('1696_remove.jpg', 10, 10);
        PhotoLibrary::removeFile($path);

        $this->assertFileDoesNotExist($path);
    }
}
