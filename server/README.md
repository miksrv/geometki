# Geometki API

CodeIgniter 4 REST API for [geometki.com](https://geometki.com). Setup, deployment and the overall architecture are described in the [root README](../README.md); the endpoint reference is in [API.md](API.md).

Requirements: PHP 8.2+ with `intl`, `mbstring`, `json`, `mysqlnd`, `curl`; MySQL. The web server must point to `public/`, not to the project root.

## Cron

One cron job for everything, every 5 minutes:

```cron
*/5 * * * * cd /path/to/server && php spark cron:run >> /dev/null 2>&1
```

`cron:run` starts the jobs that are due, each by its setting in `app/Config/Cron.php`, changed in `.env` without a deploy of code (`cron.notifications = 20m`). A setting is an interval (`5m`, `20m`, `1h`, `12h`, `1d`), a time of day (`09:00`, Moscow time), a day and a time (`mon 09:00`; in `.env` in quotes: `cron.digest = "mon 09:00"`) or `off`. `php spark cron:run --list` shows when each job last ran and runs next.

| Setting | Command | Default | What |
|---------|---------|---------|------|
| `cron.notifications` | `notifications:send` | `5m` | push and email, daily cleanup of the queues |
| `cron.game` | `game:tick` | `00:05` | close the seasons that are over |
| `cron.trending` | `trending:refresh` | `1h` | trending scores |
| `cron.digest` | `digest:weekly` | `mon 09:00` | weekly digest |
| `cron.osm` | `osm:collect` | `20m` | OSM candidates for queued tiles |
| `cron.outlines` | `places:outlines` | `20m` | OSM outlines of new large places (game) |

Every job is still an ordinary command and runs by hand the same way (`php spark notifications:send`). A job still running when it is due again is skipped; one failing job does not stop the others (`writable/logs`). A timed job starts on the first tick after its time and never catches up on the first run (no digest on the day of a deploy).

Run by hand, not on a schedule: `notifications:prune` and `sessions:prune` when the tables grow; `achievements:evaluate --all` after adding or changing an achievement (achievements are otherwise checked on every action); `achievements:rebuild` after raising a threshold — it quietly takes back the awards no longer met, gives the missing ones and recounts the levels (`--dry-run` first, back up the database). `interests:refresh` is not needed either: interest profiles refresh on demand when stale. All commands: `php spark list`, or the table in [API.md](API.md#cli-commands).
