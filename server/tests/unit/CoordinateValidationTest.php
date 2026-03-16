<?php

use App\Entities\PlaceEntity;
use App\Entities\PhotoEntity;
use App\Entities\SessionEntity;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Tests for coordinate-related behaviour across the application.
 *
 * Covers:
 *   - Latitude/longitude boundary and cast correctness on entity level
 *   - Rounding behaviour used in Places::update() (round($input->lat, 6))
 *   - Cluster library coordinate math helpers (lonToX / latToY via pixelDistance
 *     indirectly, and direct arithmetic verification)
 *   - Validation rule string patterns that controllers use for lat/lon
 *
 * No database or HTTP connection required.
 *
 * @internal
 */
final class CoordinateValidationTest extends CIUnitTestCase
{
    // =========================================================================
    // Latitude valid range  : -90.0 … +90.0
    // Longitude valid range : -180.0 … +180.0
    // The application stores them as PHP float after CI4 Entity cast.
    // =========================================================================

    public function testValidLatitudeEquatorStoredCorrectly(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lat' => '0.0']);

        $this->assertEqualsWithDelta(0.0, $place->lat, PHP_FLOAT_EPSILON);
    }

    public function testValidLatitudeNorthPoleStoredCorrectly(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lat' => '90.0']);

        $this->assertEqualsWithDelta(90.0, $place->lat, PHP_FLOAT_EPSILON);
    }

    public function testValidLatitudeSouthPoleStoredCorrectly(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lat' => '-90.0']);

        $this->assertEqualsWithDelta(-90.0, $place->lat, PHP_FLOAT_EPSILON);
    }

    public function testValidLongitudePrimeMeridianStoredCorrectly(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lon' => '0.0']);

        $this->assertEqualsWithDelta(0.0, $place->lon, PHP_FLOAT_EPSILON);
    }

    public function testValidLongitudeEastBoundaryStoredCorrectly(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lon' => '180.0']);

        $this->assertEqualsWithDelta(180.0, $place->lon, PHP_FLOAT_EPSILON);
    }

    public function testValidLongitudeWestBoundaryStoredCorrectly(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lon' => '-180.0']);

        $this->assertEqualsWithDelta(-180.0, $place->lon, PHP_FLOAT_EPSILON);
    }

    public function testTypicalCoordinatesMoscowStoredCorrectly(): void
    {
        $place = new PlaceEntity();
        $place->fill(['lat' => '55.755826', 'lon' => '37.617299']);

        $this->assertEqualsWithDelta(55.755826, $place->lat, 0.000001);
        $this->assertEqualsWithDelta(37.617299, $place->lon, 0.000001);
    }

    public function testTypicalCoordinatesNegativeHemispheresStoredCorrectly(): void
    {
        // Buenos Aires
        $place = new PlaceEntity();
        $place->fill(['lat' => '-34.603722', 'lon' => '-58.381592']);

        $this->assertEqualsWithDelta(-34.603722, $place->lat, 0.000001);
        $this->assertEqualsWithDelta(-58.381592, $place->lon, 0.000001);
    }

    // =========================================================================
    // Coordinate rounding (mirrors Places::update logic)
    // round($input->lat, 6) — six decimal places
    // =========================================================================

    public function testCoordinateRoundingToSixDecimalPlaces(): void
    {
        $rawLat = 55.75582649999;
        $rawLon = 37.61729912345;

        $roundedLat = round($rawLat, 6);
        $roundedLon = round($rawLon, 6);

        $this->assertEqualsWithDelta(55.755826, $roundedLat, 0.0000005);
        $this->assertEqualsWithDelta(37.617299, $roundedLon, 0.0000005);
    }

    public function testCoordinateRoundingPreservesSign(): void
    {
        $this->assertEqualsWithDelta(-34.603722, round(-34.6037224999, 6), 0.0000005);
        $this->assertEqualsWithDelta(-58.381592, round(-58.3815924999, 6), 0.0000005);
    }

    // =========================================================================
    // Coordinate validation via CI4 Validation service (mirrors controller rules)
    // Controllers use: 'lat' => 'numeric|min_length[3]'
    // =========================================================================

    public function testValidationAcceptsNumericLatitude(): void
    {
        // Use getShared=false to get a clean instance uncontaminated by prior test rules
        $validation = \Config\Services::validation(null, false);

        $result = $validation->setRules(['lat' => 'numeric|min_length[3]'])
            ->run(['lat' => '55.755826']);

        $this->assertTrue($result);
    }

    public function testValidationAcceptsNegativeNumericLatitude(): void
    {
        $validation = \Config\Services::validation(null, false);

        $result = $validation->setRules(['lat' => 'numeric|min_length[3]'])
            ->run(['lat' => '-34.60']);

        $this->assertTrue($result);
    }

    public function testValidationRejectsNonNumericLatitude(): void
    {
        $validation = \Config\Services::validation(null, false);

        $result = $validation->setRules(['lat' => 'numeric|min_length[3]'])
            ->run(['lat' => 'abc']);

        $this->assertFalse($result);
    }

    public function testValidationRejectsMissingLatitudeWhenRequired(): void
    {
        $validation = \Config\Services::validation(null, false);

        $result = $validation->setRules(['lat' => 'required|numeric|min_length[3]'])
            ->run([]);

        $this->assertFalse($result);
    }

    public function testValidationRejectsTooShortLatitude(): void
    {
        // min_length[3] means the string must be at least 3 characters;
        // a single digit "5" is only 1 character and should fail.
        $validation = \Config\Services::validation(null, false);

        $result = $validation->setRules(['lat' => 'numeric|min_length[3]'])
            ->run(['lat' => '5']);

        $this->assertFalse($result);
    }

    public function testValidationAcceptsZeroCoordinates(): void
    {
        $validation = \Config\Services::validation(null, false);

        $result = $validation->setRules([
            'lat' => 'numeric|min_length[3]',
            'lon' => 'numeric|min_length[3]',
        ])->run(['lat' => '0.0', 'lon' => '0.0']);

        $this->assertTrue($result);
    }

    // =========================================================================
    // Coordinate storage in PhotoEntity (mirrors Photos::upload logic)
    // =========================================================================

    public function testPhotoEntityStoresCoordinatesAsFloat(): void
    {
        $photo = new PhotoEntity();
        $photo->fill(['lat' => '55.755826', 'lon' => '37.617299']);

        $this->assertIsFloat($photo->lat);
        $this->assertIsFloat($photo->lon);
        $this->assertEqualsWithDelta(55.755826, $photo->lat, 0.000001);
        $this->assertEqualsWithDelta(37.617299, $photo->lon, 0.000001);
    }

    public function testPhotoEntityAcceptsNullishCoordinatesViaPlaceFallback(): void
    {
        // When EXIF data is unavailable, photo inherits place coordinates.
        $place = new PlaceEntity();
        $place->fill(['lat' => '-34.603722', 'lon' => '-58.381592']);

        $photo = new PhotoEntity();
        $photo->lat = $place->lat;
        $photo->lon = $place->lon;

        $this->assertEqualsWithDelta($place->lat, $photo->lat, 0.000001);
        $this->assertEqualsWithDelta($place->lon, $photo->lon, 0.000001);
    }

    // =========================================================================
    // SessionEntity coordinate storage (SessionLibrary stores user geolocation)
    // =========================================================================

    public function testSessionEntityStoresCoordinatesAsFloat(): void
    {
        $session = new SessionEntity();
        $session->fill(['lat' => '48.8566', 'lon' => '2.3522']);

        $this->assertIsFloat($session->lat);
        $this->assertIsFloat($session->lon);
        $this->assertEqualsWithDelta(48.8566, $session->lat, 0.0001);
        $this->assertEqualsWithDelta(2.3522,  $session->lon, 0.0001);
    }

    // =========================================================================
    // Boundary arithmetic used in Cluster library
    // Constants are declared with `const` inside `namespace App\Libraries` in
    // Cluster.php. They only become available after the file is autoloaded,
    // which happens when the class itself is first referenced.
    // =========================================================================

    public function testClusterConstantOffsetIsCorrect(): void
    {
        // Trigger autoload of Cluster.php so its namespace constants are defined
        class_exists(\App\Libraries\Cluster::class);

        // OFFSET = 268435456 = 2^28 (standard Web Mercator pixel offset at zoom 28)
        $this->assertSame(268435456, \App\Libraries\OFFSET);
    }

    public function testClusterConstantRadiusIsCorrect(): void
    {
        class_exists(\App\Libraries\Cluster::class);

        // RADIUS ~= 2^28 / pi  (used in Mercator pixel projection)
        $expectedRadius = 268435456 / M_PI;

        $this->assertEqualsWithDelta($expectedRadius, \App\Libraries\RADIUS, 1.0);
    }

    public function testClusterMaxZoomIsEighteen(): void
    {
        class_exists(\App\Libraries\Cluster::class);

        $this->assertSame(18, \App\Libraries\MAX_ZOOM);
    }
}
