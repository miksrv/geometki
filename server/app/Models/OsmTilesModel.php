<?php

namespace App\Models;

use App\Entities\OsmTileEntity;
use CodeIgniter\I18n\Time;
use Config\OsmCandidates;

/**
 * Model for the `osm_tiles` table: the collection queue of OSM candidates.
 *
 * A tile is a row, not a queue entry: asking for it again only raises its priority,
 * so the same tile is never collected twice before its refresh date.
 *
 * @package App\Models
 */
class OsmTilesModel extends ApplicationBaseModel
{
    public const STATUS_QUEUED     = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_DONE       = 'done';
    public const STATUS_FAILED     = 'failed';

    protected $table            = 'osm_tiles';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = OsmTileEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'tile_lat',
        'tile_lon',
        'status',
        'priority',
        'attempts',
        'last_error',
        'candidates_count',
        'requested_at',
        'fetched_at',
        'next_fetch_at',
        'locked_at',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Marks the tiles as wanted: new ones are queued, the known ones get a higher priority,
     * and the ones due for a refresh (or a retry after a failure) are queued again.
     *
     * @param array<int, array{0: int, 1: int}> $tiles tile_lat, tile_lon
     * @return array<string, array> "lat:lon" => [id, status, fetched_at] after the update
     */
    public function request(array $tiles): array
    {
        if (!$tiles) {
            return [];
        }

        $now    = Time::now()->toDateTimeString();
        $values = [];
        $binds  = [];

        foreach ($tiles as [$tileLat, $tileLon]) {
            $values[] = '(?, ?, ?, 1, ?, ?, ?)';
            array_push($binds, $tileLat, $tileLon, self::STATUS_QUEUED, $now, $now, $now);
        }

        $this->db->query(
            'INSERT INTO ' . $this->db->prefixTable($this->table)
            . ' (tile_lat, tile_lon, status, priority, requested_at, created_at, updated_at) VALUES '
            . implode(', ', $values)
            . ' ON DUPLICATE KEY UPDATE'
            . ' priority = priority + 1,'
            . ' requested_at = VALUES(requested_at),'
            . " status = IF(status IN ('done', 'failed') AND next_fetch_at IS NOT NULL AND next_fetch_at <= VALUES(requested_at), 'queued', status)",
            $binds
        );

        $rows = $this->builder()
            ->select('id, tile_lat, tile_lon, status, fetched_at')
            ->groupStart();

        foreach ($tiles as [$tileLat, $tileLon]) {
            $rows->orGroupStart()->where('tile_lat', $tileLat)->where('tile_lon', $tileLon)->groupEnd();
        }

        $result = [];

        foreach ($rows->groupEnd()->get()->getResultArray() as $row) {
            $result["{$row['tile_lat']}:{$row['tile_lon']}"] = $row;
        }

        return $result;
    }

    /**
     * Prepares the queue for a collector run: fails the tiles of dead collectors and queues
     * the tiles due for a refresh, but only those somebody looked at recently
     */
    public function prepareQueue(OsmCandidates $config): void
    {
        $now = Time::now();

        // A dead collector counts as a failure: a tile that kills the process (memory, cron timeout)
        // must not be taken first again and again
        $stale = $this->where('status', self::STATUS_PROCESSING)
            ->where('locked_at <', $now->subMinutes($config->staleLockMinutes)->toDateTimeString())
            ->findAll();

        foreach ($stale as $tile) {
            $this->markFailed($tile, 'The collector stopped while working on the tile', $config);
        }

        $this->builder()
            ->set('status', self::STATUS_QUEUED)
            ->whereIn('status', [self::STATUS_DONE, self::STATUS_FAILED])
            ->where('next_fetch_at <=', $now->toDateTimeString())
            ->where('requested_at >=', $now->subDays($config->activeDays)->toDateTimeString())
            ->update();
    }

    /**
     * Takes the most wanted queued tile. The status change is atomic, so two collectors
     * running at the same time never take the same tile.
     */
    public function claimNext(): ?OsmTileEntity
    {
        for ($try = 0; $try < 5; $try++) {
            $tile = $this->where('status', self::STATUS_QUEUED)
                ->orderBy('priority', 'DESC')
                ->orderBy('id', 'ASC')
                ->first();

            if (!$tile) {
                return null;
            }

            $this->builder()
                ->set('status', self::STATUS_PROCESSING)
                ->set('locked_at', Time::now()->toDateTimeString())
                ->where('id', $tile->id)
                ->where('status', self::STATUS_QUEUED)
                ->update();

            if ($this->db->affectedRows() === 1) {
                return $tile;
            }
        }

        return null;
    }

    public function markDone(int $id, int $candidatesCount, OsmCandidates $config): void
    {
        $now = Time::now();

        $this->builder()
            ->set([
                'status'           => self::STATUS_DONE,
                'attempts'         => 0,
                'last_error'       => null,
                'candidates_count' => $candidatesCount,
                'fetched_at'       => $now->toDateTimeString(),
                'next_fetch_at'    => $now->addDays($config->refreshDays)->toDateTimeString(),
                'locked_at'        => null,
                'updated_at'       => $now->toDateTimeString(),
            ])
            ->where('id', $id)
            ->update();
    }

    /**
     * A failed tile is retried later and later: 1 h, 2 h, 4 h… After `maxAttempts`
     * failures in a row it waits for the regular refresh
     */
    public function markFailed(OsmTileEntity $tile, string $error, OsmCandidates $config): void
    {
        $now      = Time::now();
        $attempts = $tile->attempts + 1;
        $retryAt  = $attempts >= $config->maxAttempts
            ? $now->addDays($config->refreshDays)
            : $now->addHours(2 ** ($attempts - 1));

        $this->builder()
            ->set([
                'status'        => self::STATUS_FAILED,
                'attempts'      => $attempts,
                'last_error'    => mb_substr($error, 0, 500),
                'next_fetch_at' => $retryAt->toDateTimeString(),
                'locked_at'     => null,
                'updated_at'    => $now->toDateTimeString(),
            ])
            ->where('id', $tile->id)
            ->update();
    }
}
