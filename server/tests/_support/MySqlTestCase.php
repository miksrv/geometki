<?php

namespace Tests\Support;

use CodeIgniter\Test\CIUnitTestCase;
use Config\Database;
use Config\Services;

/**
 * A test against the full schema on MySQL: the queues and most queries use MySQL
 * SQL (NOW(), DATE_ADD, IF, FULLTEXT) that SQLite does not run.
 *
 * Runs only when the `tests` connection group is MySQL (`database.tests.*` in the
 * environment, see tests/README.md), skipped otherwise. The application's migrations
 * run once per PHPUnit process; each test starts from empty tables.
 */
abstract class MySqlTestCase extends CIUnitTestCase
{
    private static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        if ((config('Database')->tests['DBDriver'] ?? '') !== 'MySQLi') {
            $this->markTestSkipped('Needs MySQL: set database.tests.* (tests/README.md)');
        }

        $this->db = Database::connect('tests');

        if (!self::$migrated) {
            $this->migrate();
            self::$migrated = true;
        }

        $this->truncateAll();
    }

    private function migrate(): void
    {
        $this->db->query('SET FOREIGN_KEY_CHECKS = 0');

        foreach ($this->db->listTables() as $table) {
            $this->db->query('DROP TABLE IF EXISTS `' . $table . '`');
        }

        $this->db->query('SET FOREIGN_KEY_CHECKS = 1');
        $this->db->resetDataCache();

        $runner = Services::migrations(null, $this->db, false);
        $runner->setNamespace('App');

        if (!$runner->latest('tests')) {
            $this->fail('The migrations did not run');
        }
    }

    private function truncateAll(): void
    {
        $this->db->query('SET FOREIGN_KEY_CHECKS = 0');

        foreach ($this->db->listTables() as $table) {
            if ($table !== 'migrations') {
                $this->db->query('TRUNCATE TABLE `' . $table . '`');
            }
        }

        $this->db->query('SET FOREIGN_KEY_CHECKS = 1');
    }

    /**
     * A user row with only what the schema requires.
     */
    protected function createUser(string $id, array $fields = []): void
    {
        $this->db->table('users')->insert($fields + [
            'id'    => $id,
            'name'  => 'User ' . $id,
            'email' => $id . '@example.com',
        ]);
    }

    /**
     * A push device of $userId; returns its row.
     */
    protected function createSubscription(string $id, string $userId, string $endpoint, array $fields = []): object
    {
        $this->db->table('push_subscriptions')->insert($fields + [
            'id'            => $id,
            'user_id'       => $userId,
            'endpoint'      => $endpoint,
            'endpoint_hash' => hash('sha256', $endpoint),
            'p256dh'        => 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
            'auth'          => 'tBHItJI5svbpez7KI4CCXg',
            'timezone'      => 'Europe/Moscow',
            'locale'        => 'ru',
        ]);

        return $this->db->table('push_subscriptions')->where('id', $id)->get()->getRow();
    }
}
