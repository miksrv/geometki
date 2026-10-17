<?php

namespace App\Libraries;

use Config\GuestCache as GuestCacheConfig;

/**
 * The store of the guest cache: one file per answer in its own folder, so a write clears
 * it with one sweep and nothing else in writable/cache is touched.
 */
class GuestCache
{
    private GuestCacheConfig $config;

    public function __construct(?GuestCacheConfig $config = null)
    {
        $this->config = $config ?? config('GuestCache');
    }

    /** The answer saved under the key, while it is fresh */
    public function get(string $key): ?string
    {
        $file = $this->file($key);

        if (!is_file($file) || filemtime($file) < time() - $this->config->ttl) {
            return null;
        }

        $body = @file_get_contents($file);

        return $body === false ? null : $body;
    }

    public function save(string $key, string $body): void
    {
        if (!is_dir($this->config->path) && !@mkdir($this->config->path, 0755, true) && !is_dir($this->config->path)) {
            return;
        }

        // Written aside and renamed: a reader never gets half a file
        $file = $this->file($key);
        $temp = $file . '.' . bin2hex(random_bytes(4));

        if (@file_put_contents($temp, $body) !== false) {
            @rename($temp, $file);
        }
    }

    /** Clears every answer: something guests see has changed */
    public function flush(): int
    {
        return $this->delete(static fn () => true);
    }

    /** Deletes the answers past their time: files nobody asked for again stay otherwise */
    public function prune(): int
    {
        $before = time() - $this->config->ttl;

        return $this->delete(static fn (string $file) => (int) @filemtime($file) < $before);
    }

    private function delete(callable $match): int
    {
        $deleted = 0;

        foreach (glob($this->config->path . '*.json') ?: [] as $file) {
            if ($match($file) && @unlink($file)) {
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
