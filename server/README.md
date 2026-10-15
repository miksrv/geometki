# Geometki API

CodeIgniter 4 REST API for [geometki.com](https://geometki.com). Setup, deployment and the overall architecture are described in the [root README](../README.md); the endpoint reference is in [API.md](API.md).

Requirements: PHP 8.2+ with `intl`, `mbstring`, `json`, `mysqlnd`, `curl`; MySQL. The web server must point to `public/`, not to the project root.

## Cron

The whole schedule (times are the server's clock):

```cron
* * * * *  cd /path/to/server && php spark notifications:send >> /dev/null 2>&1   # push and email, daily cleanup of the queues
* * * * *  cd /path/to/server && php spark osm:collect >> /dev/null 2>&1          # OSM candidates for queued tiles
0 * * * *  cd /path/to/server && php spark trending:refresh >> /dev/null 2>&1     # trending scores
0 9 * * 1  cd /path/to/server && php spark digest:weekly >> /dev/null 2>&1        # weekly digest, Monday
```

Run by hand, not on a schedule: `notifications:prune` and `sessions:prune` when the tables grow; `achievements:evaluate --all` after adding or changing an achievement (achievements are otherwise checked on every action). `interests:refresh` is not needed either: interest profiles refresh on demand when stale. All commands: `php spark list`, or the table in [API.md](API.md#cli-commands).
