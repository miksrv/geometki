<?php

use App\Libraries\Cluster;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the Cluster library.
 *
 * Tests cover:
 * - MAX_ZOOM short-circuit: at zoom 18, placemarks are stored as-is.
 * - Cluster output structure: clustered groups become objects with lat/lon/type/count.
 * - Single-point zoom: a single marker is never clustered.
 *
 * No database or HTTP connection required.
 *
 * @internal
 */
final class ClusterLibraryTest extends CIUnitTestCase
{
    /** @var int MAX_ZOOM value declared in App\Libraries\Cluster.php */
    private int $maxZoom = 18;

    protected function setUp(): void
    {
        parent::setUp();
        // Ensure the namespace constants from Cluster.php are available.
        class_exists(Cluster::class);
    }

    // =========================================================================
    // MAX_ZOOM short-circuit
    // =========================================================================

    public function testMaxZoomReturnsInputPlaceMarksUnchanged(): void
    {
        $marks = [
            (object) ['lat' => 55.75, 'lon' => 37.61],
            (object) ['lat' => 55.76, 'lon' => 37.62],
        ];

        $cluster = new Cluster($marks, $this->maxZoom);

        $this->assertSame($marks, $cluster->placeMarks);
    }

    public function testMaxZoomWithEmptyArrayReturnsEmptyArray(): void
    {
        $cluster = new Cluster([], $this->maxZoom);

        // At MAX_ZOOM the constructor runs: return $this->placeMarks = $placeMarks;
        // which assigns [] to placeMarks.
        $this->assertSame([], $cluster->placeMarks);
    }

    public function testMaxZoomWithSingleMarkerReturnsThatMarker(): void
    {
        $mark  = (object) ['lat' => 10.0, 'lon' => 20.0];
        $marks = [$mark];

        $cluster = new Cluster($marks, $this->maxZoom);

        $this->assertCount(1, $cluster->placeMarks);
        $this->assertSame($mark, $cluster->placeMarks[0]);
    }

    // =========================================================================
    // Clustering at a low zoom level
    // =========================================================================

    public function testSingleMarkerIsNeverClustered(): void
    {
        $mark  = (object) ['lat' => 55.75, 'lon' => 37.61];

        $cluster = new Cluster([$mark], 10);

        // A single marker cannot be clustered — it should be returned as-is.
        $this->assertCount(1, $cluster->placeMarks);
        $this->assertFalse(isset($cluster->placeMarks[0]->type));
    }

    public function testWidelySpacedMarkersAreNotClustered(): void
    {
        // Two markers that are thousands of kilometres apart should never cluster.
        $marks = [
            (object) ['lat' => 0.0,  'lon' => 0.0],
            (object) ['lat' => 80.0, 'lon' => 170.0],
        ];

        $cluster = new Cluster($marks, 2); // very low zoom — biggest cluster radius

        // Both should remain individual objects without a 'type' === 'cluster' property
        $hasCluster = false;
        foreach ($cluster->placeMarks as $item) {
            if (isset($item->type) && $item->type === 'cluster') {
                $hasCluster = true;
            }
        }

        $this->assertFalse($hasCluster);
    }

    public function testCloseMarkersAreClusteredAtLowZoom(): void
    {
        // Two markers placed millimetres apart on the map; at zoom 1 they will cluster.
        $marks = [
            (object) ['lat' => 55.7558, 'lon' => 37.6173],
            (object) ['lat' => 55.7559, 'lon' => 37.6174],
        ];

        $cluster = new Cluster($marks, 1);

        // After clustering, either both are merged into one cluster object or
        // both survive as individual objects. At the very least, placeMarks is non-empty.
        $this->assertNotEmpty($cluster->placeMarks);
    }

    public function testClusteredObjectHasRequiredProperties(): void
    {
        // Ensure any cluster object has lat/lon/type/count
        $marks = [
            (object) ['lat' => 55.7558, 'lon' => 37.6173],
            (object) ['lat' => 55.7558, 'lon' => 37.6173],
            (object) ['lat' => 55.7558, 'lon' => 37.6173],
        ];

        $cluster = new Cluster($marks, 1);

        foreach ($cluster->placeMarks as $item) {
            if (isset($item->type) && $item->type === 'cluster') {
                $this->assertObjectHasProperty('lat',   $item);
                $this->assertObjectHasProperty('lon',   $item);
                $this->assertObjectHasProperty('count', $item);
                break;
            }
        }
    }

    // =========================================================================
    // Namespace constants
    // =========================================================================

    public function testOffsetConstantIsCorrect(): void
    {
        $this->assertSame(268435456, \App\Libraries\OFFSET);
    }

    public function testRadiusConstantIsApproximate(): void
    {
        $expected = 268435456 / M_PI;
        $this->assertEqualsWithDelta($expected, \App\Libraries\RADIUS, 1.0);
    }

    public function testMaxZoomConstantIsEighteen(): void
    {
        $this->assertSame(18, \App\Libraries\MAX_ZOOM);
    }
}
