<?php

namespace App\Libraries;

use Config\GuestCache as GuestCacheConfig;

/**
 * The store of the guest cache: one file per answer in its own folder, so a write clears
 * it with one rename and nothing else in writable/cache is touched.
 */
class GuestCache
{
    /** The suffix of a cleared folder waiting for sweep() */
    private const CLEARED = '.cleared-';

    private GuestCacheConfig $config;

    public function __construct(?GuestCacheConfig $config = null)
    {
        $this->config = $config ?? config('GuestCache');
    }

    /** The answer saved under the key, while it is younger than $ttl seconds */
    public function get(string $key, ?int $ttl = null): ?string
    {
        $file = $this->file($key);

        if (!is_file($file) || filemtime($file) < time() - ($ttl ?? $this->config->ttl)) {
            return null;
        }

        $body = @file_get_contents($file);

        return $body === false ? null : $body;
    }

    /**
     * Which folder the answers are in now (made if missing): a flush renames it away. Taken
     * before a request reads the database, compared before its answer is saved (save()).
     * Null when the folder cannot be made: nothing is cached then anyway
     */
    public function generation(): ?int
    {
        $path = rtrim($this->config->path, '/');

        if (!is_dir($path)) {
            @mkdir($path, 0755, true);
        }

        clearstatcache(true, $path);
        $inode = @fileinode($path);

        return $inode === false ? null : $inode;
    }

    /**
     * Saves the answer, unless the cache was cleared since $generation was taken: an answer
     * read before a write would go into the fresh folder and outlive the write by a day
     */
    public function save(string $key, string $body, ?int $generation = null): void
    {
        if ($generation !== null && $generation !== $this->generation()) {
            return;
        }

        if (!is_dir($this->config->path) && !@mkdir($this->config->path, 0755, true) && !is_dir($this->config->path)) {
            return;
        }

        // Written aside and renamed: a reader never gets half a file
        $file = $this->file($key);
        $temp = $file . '.' . bin2hex(random_bytes(4));

        if (@file_put_contents($temp, $body) !== false && !@rename($temp, $file)) {
            @unlink($temp);
        }
    }

    /**
     * Clears every answer: something guests see has changed. The folder is renamed, not
     * emptied: tens of thousands of files would hold up the request that wrote; sweep()
     * deletes them later. Returns false when there was nothing to clear.
     */
    public function flush(): bool
    {
        $path = rtrim($this->config->path, '/');

        return is_dir($path) && @rename($path, $path . self::CLEARED . bin2hex(random_bytes(4)));
    }

    /** Deletes the cleared folders (a cron job, see NotificationsSend), returns the files deleted */
    public function sweep(): int
    {
        $deleted = 0;

        foreach (glob(rtrim($this->config->path, '/') . self::CLEARED . '*', GLOB_ONLYDIR) ?: [] as $folder) {
            foreach (glob($folder . '/*') ?: [] as $file) {
                if (@unlink($file)) {
                    $deleted++;
                }
            }

            @rmdir($folder);
        }

        return $deleted;
    }

    /** Deletes the answers past their time: files nobody asked for again stay otherwise */
    public function prune(): int
    {
        $before  = time() - $this->config->ttl;
        $deleted = 0;

        foreach (glob($this->config->path . '*.json') ?: [] as $file) {
            if ((int) @filemtime($file) < $before && @unlink($file)) {
                $deleted++;
            }
        }

        return $deleted;
    }

    private function file(string $key): string
    {
        return $this->config->path . md5($key) . '.json';
    }
}
