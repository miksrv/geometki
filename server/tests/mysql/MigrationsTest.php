<?php

use Tests\Support\MySqlTestCase;

/**
 * The application's migrations build the whole schema on an empty database.
 *
 * @internal
 */
final class MigrationsTest extends MySqlTestCase
{
    public function testTheFullSchemaIsBuilt(): void
    {
        $tables = $this->db->listTables();

        foreach (['users', 'places', 'places_content', 'activity', 'comments', 'feed', 'sending_mail', 'push_messages', 'push_subscriptions'] as $table) {
            $this->assertContains($table, $tables);
        }
    }
}
