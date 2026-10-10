# API tests

PHPUnit tests for the API. Run from `server/`:

```bash
composer install
composer test                       # or vendor/bin/phpunit
vendor/bin/phpunit tests/unit/SlugHelperTest.php   # a single file
```

- `unit/` — the project's tests; they need no database.
- `database/`, `session/`, `_support/` — CodeIgniter's example tests and their support classes. Database tests use the `tests` connection group (`app/Config/Database.php` or `phpunit.xml`).

Configuration is in `phpunit.xml.dist`; copy it to `phpunit.xml` (git-ignored) for local changes. CI (`.github/workflows/api-checks.yml`) runs `vendor/bin/phpunit --no-coverage` on pull requests that touch `server/`.

Docs: [CodeIgniter 4 testing](https://codeigniter4.github.io/userguide/testing/index.html), [PHPUnit](https://phpunit.de/documentation.html).
