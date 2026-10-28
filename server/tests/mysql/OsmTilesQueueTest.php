<?php

use App\Models\OsmTilesModel;
use CodeIgniter\I18n\Time;
use Config\OsmCandidates;
use Tests\Support\MySqlTestCase;

/**
 * The tile queue of the OSM candidates: a map request queues the tiles it has never seen,
 * but an area asked for within `requestCooldownMinutes` is only read, so looking at a
 * collected area writes nothing and polling a pending one does not pump up its priority.
 *
 * @internal
 */
final class OsmTilesQueueTest extends MySqlTestCase
{
    private OsmCandidates $config;

    protected function setUp(): void
    {
        parent::setUp();

        $this->config                         = config('OsmCandidates');
        $this->config->requestCooldownMinutes = 10;
    }

    public function testQueuesNewTiles(): void
    {
        $tiles = (new OsmTilesModel())->request([[531, 572], [531, 573]], $this->config);

        $this->assertSame(['queued', 'queued'], array_column(array_values($tiles), 'status'));
        $this->assertSame(['1', '1'], array_column($this->rows(), 'priority'));
    }

    public function testRepeatedRequestWithinCooldownWritesNothing(): void
    {
        $model = new OsmTilesModel();

        $model->request([[531, 572]], $this->config);
        $tiles = $model->request([[531, 572]], $this->config, static fn (): bool => throw new LogicException('No write expected'));

        $this->assertSame('queued', $tiles['531:572']['status']);
        $this->assertSame('1', $this->rows()[0]['priority']);
    }

    public function testRequestAfterCooldownRaisesPriority(): void
    {
        $this->insertTile('queued', requestedAt: Time::now()->subMinutes(11));

        (new OsmTilesModel())->request([[531, 572]], $this->config);

        $this->assertSame('1', $this->rows()[0]['priority']);
    }

    public function testDueTileIsQueuedAgainEvenWithinCooldown(): void
    {
        $this->insertTile('done', requestedAt: Time::now()->subMinutes(1), nextFetchAt: Time::now()->subDays(1));

        $tiles = (new OsmTilesModel())->request([[531, 572]], $this->config);

        $this->assertSame('queued', $tiles['531:572']['status']);
    }

    public function testDeniedWriteOnlyReads(): void
    {
        $this->insertTile('queued', requestedAt: Time::now()->subHours(1));

        $tiles = (new OsmTilesModel())->request([[531, 572], [531, 573]], $this->config, static fn (): bool => false);

        // The known tile is still reported (pending), the new one is not queued
        $this->assertSame(['531:572'], array_keys($tiles));
        $this->assertCount(1, $this->rows());
        $this->assertSame('0', $this->rows()[0]['priority']);
    }

    private function insertTile(string $status, Time $requestedAt, ?Time $nextFetchAt = null): void
    {
        $this->db->table('osm_tiles')->insert([
            'tile_lat'      => 531,
            'tile_lon'      => 572,
            'status'        => $status,
            'priority'      => 0,
            'requested_at'  => $requestedAt->toDateTimeString(),
            'fetched_at'    => $status === 'done' ? Time::now()->subDays(60)->toDateTimeString() : null,
            'next_fetch_at' => $nextFetchAt?->toDateTimeString(),
        ]);
    }

    private function rows(): array
    {
        return $this->db->table('osm_tiles')->select('tile_lat, tile_lon, status, priority')
            ->orderBy('tile_lat')->orderBy('tile_lon')->get()->getResultArray();
    }
}
