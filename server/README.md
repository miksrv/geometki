# Geometki API

CodeIgniter 4 REST API for [geometki.com](https://geometki.com). Setup, deployment and the overall architecture are described in the [root README](../README.md); the endpoint reference is in [API.md](API.md).

## Quick start

```bash
composer install
cp env .env               # set app.baseURL, database.default.*, JWT secret
php spark migrate
php spark serve           # http://localhost:8080
```

The web server must point to `public/`, not to the project root.

## Useful commands

```bash
composer test             # PHPUnit
php spark routes          # all routes
php spark list            # all commands, including the cron ones (see Cron below)
```

## Cron

The whole schedule (times are the server's clock):

```cron
* * * * *  cd /path/to/server && php spark notifications:send >> /dev/null 2>&1   # push and email, daily cleanup of the queues
* * * * *  cd /path/to/server && php spark osm:collect >> /dev/null 2>&1          # OSM candidates for queued tiles
0 * * * *  cd /path/to/server && php spark trending:refresh >> /dev/null 2>&1     # trending scores
0 9 * * 1  cd /path/to/server && php spark digest:weekly >> /dev/null 2>&1        # weekly digest, Monday
```

`notifications:prune` and `sessions:prune` are not scheduled: run them by hand when the tables grow. `interests:refresh` is not needed on a schedule either: interest profiles refresh on demand when stale (`PlacesModel::maybeRefreshUserInterests`). Neither is `achievements:evaluate`: achievements are checked on every action; run `achievements:evaluate --all` after adding or changing an achievement. `notifications:send` replaces the former `system:send-email`: update the crontab when deploying, and remove the lines of `system:send-email`, `email:cleanup`, `system:calculate-tags-count`, `system:generate-users-online` (these commands no longer exist), `sessions:prune`, `notifications:prune` and `achievements:evaluate` (manual now).

Migrations live in `app/Database/Migrations/`; always add a new migration, never edit an existing one.

Requirements: PHP 8.2+ with `intl`, `mbstring`, `json`, `mysqlnd`, `curl`; MySQL.
