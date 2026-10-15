# API tests

PHPUnit tests for the API, run from `server/` with `composer test`; a single file: `vendor/bin/phpunit tests/unit/SlugHelperTest.php`.

- `unit/` — the project's tests; they need no database.
- `database/` — tests against a database (the `tests` connection group in `app/Config/Database.php` or `phpunit.xml`): `PlacesTextsEndpointTest` plus CodeIgniter's examples; `session/`, `_support/` — CodeIgniter's example tests and support classes.

Configuration is in `phpunit.xml.dist`; copy it to `phpunit.xml` (git-ignored) for local changes. CI (`.github/workflows/api-checks.yml`) runs `vendor/bin/phpunit --no-coverage` on pull requests that touch `server/`.
