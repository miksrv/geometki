<?php

use App\Libraries\PlaceCoverLibrary;
use App\Models\PlacesExternalPhotosModel;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Which linked photos can become a place cover (PlacesExternalPhotosModel::canBeCover) and how
 * a crop box is fitted into the image (PlaceCoverLibrary::fitCrop).
 *
 * Pure PHP — no DB, no HTTP.
 *
 * @internal
 */
final class PlaceCoverFromLinkedPhotoTest extends CIUnitTestCase
{
    private function photo(array $fields): array
    {
        return array_merge([
            'source'  => PlacesExternalPhotosModel::SOURCE_WIKIMEDIA,
            'license' => 'CC BY-SA 4.0',
            'width'   => 1280,
            'height'  => 960,
        ], $fields);
    }

    public function testACommonsPhotoWithAFreeLicenceCanBeACover(): void
    {
        $this->assertTrue(PlacesExternalPhotosModel::canBeCover($this->photo([])));
        $this->assertTrue(PlacesExternalPhotosModel::canBeCover($this->photo(['license' => 'Public domain'])));
    }

    public function testACommonsPhotoWithoutDerivativesOrWithoutALicenceCannot(): void
    {
        $this->assertFalse(PlacesExternalPhotosModel::canBeCover($this->photo(['license' => 'CC BY-ND 2.0'])));
        $this->assertFalse(PlacesExternalPhotosModel::canBeCover($this->photo(['license' => 'CC-BY-NC-ND-3.0'])));
        $this->assertFalse(PlacesExternalPhotosModel::canBeCover($this->photo(['license' => null])));
    }

    public function testAPastvuPhotoNeedsNoLicence(): void
    {
        $this->assertTrue(PlacesExternalPhotosModel::canBeCover($this->photo([
            'source'  => PlacesExternalPhotosModel::SOURCE_PASTVU,
            'license' => null,
        ])));
    }

    public function testAPhotoSmallerThanTheCoverCannot(): void
    {
        $this->assertFalse(PlacesExternalPhotosModel::canBeCover($this->photo(['width' => PLACE_COVER_MIN_WIDTH - 1])));
        $this->assertFalse(PlacesExternalPhotosModel::canBeCover($this->photo(['height' => PLACE_COVER_MIN_HEIGHT - 1])));
        $this->assertFalse(PlacesExternalPhotosModel::canBeCover($this->photo(['width' => null])));
    }

    public function testACropBoxStickingOutByRoundingIsMovedInside(): void
    {
        $this->assertSame(
            ['x' => 76, 'y' => 0, 'width' => 1024, 'height' => 341],
            PlaceCoverLibrary::fitCrop(['x' => 77, 'y' => 0, 'width' => 1024, 'height' => 341], 1100, 547)
        );
    }

    public function testACropBoxInsideTheImageIsKept(): void
    {
        $crop = ['x' => 10, 'y' => 20, 'width' => 1024, 'height' => 341];

        $this->assertSame($crop, PlaceCoverLibrary::fitCrop($crop, 1280, 960));
    }

    public function testACropBoxBiggerThanTheImageDoesNotFit(): void
    {
        $this->assertNull(PlaceCoverLibrary::fitCrop(['x' => 0, 'y' => 0, 'width' => 1300, 'height' => 400], 1280, 960));
    }
}
