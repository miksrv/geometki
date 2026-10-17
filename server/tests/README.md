# API tests

PHPUnit tests for the API, run from `server/` with `composer test`; a single file: `vendor/bin/phpunit tests/unit/SlugHelperTest.php`.

- `unit/` — the project's tests; they need no database.
- `mysql/` — tests against the full schema on MySQL (`Tests\Support\MySqlTestCase`): the application's migrations run once on an empty database, each test starts from empty tables. The queues, the push API and the endpoint smoke tests live here: their SQL is MySQL's. Skipped unless the `tests` group points to MySQL; run them on a throwaway database (every table in it is dropped):

  ```bash
  docker run -d --name geometki-tests-mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=1 -e MYSQL_DATABASE=tests -p 127.0.0.1:3399:3306 mysql:8.0
  database_tests_hostname=127.0.0.1 database_tests_port=3399 database_tests_database=tests \
      database_tests_username=root database_tests_password= database_tests_DBDriver=MySQLi database_tests_DBPrefix= \
      vendor/bin/phpunit --testsuite MySQL
  ```
- `database/` — tests against a database (the `tests` connection group in `app/Config/Database.php` or `phpunit.xml`): `PlacesTextsEndpointTest` plus CodeIgniter's examples; `session/`, `_support/` — CodeIgniter's example tests and support classes.

Configuration is in `phpunit.xml.dist`; copy it to `phpunit.xml` (git-ignored) for local changes. CI (`.github/workflows/api-checks.yml`) runs `vendor/bin/phpunit --no-coverage` on pull requests that touch `server/`, then the `MySQL` suite against a MySQL 8 service.
