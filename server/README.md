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
php spark list            # all commands, including the cron ones (system:*, digest:*, achievements:*, osm:*, ...)
```

Migrations live in `app/Database/Migrations/`; always add a new migration, never edit an existing one.

Requirements: PHP 8.2+ with `intl`, `mbstring`, `json`, `mysqlnd`, `curl`; MySQL.
