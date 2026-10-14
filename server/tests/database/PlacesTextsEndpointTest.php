<?php

use CodeIgniter\Database\BaseConnection;
use CodeIgniter\Database\Forge;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\FeatureTestTrait;
use Config\Database;

/**
 * Feature tests for GET /places/:id/texts (App\Controllers\Places::texts()).
 *
 * Regression test for a bug where the response was built with
 * `array_map(static fn ($text) => [..., $this->plainContent(...)], ...)`:
 * `$this` is unavailable inside a `static` closure, so every call threw a
 * fatal error and the endpoint returned HTTP 500 for every place in
 * production. The fix drops `static` from the closure.
 *
 * Builds just the `places` and `places_content` tables it needs directly
 * (instead of running the application's full migration set, whose FK order
 * does not resolve cleanly on a from-scratch database — see AddActivity
 * referencing the not-yet-created `comments` table — which is unrelated to
 * this fix).
 *
 * @internal
 */
final class PlacesTextsEndpointTest extends CIUnitTestCase
{
    use FeatureTestTrait;

    private Forge $forge;

    protected function setUp(): void
    {
        parent::setUp();

        $this->db    = Database::connect($this->DBGroup);
        $this->forge = Database::forge($this->DBGroup);

        $this->db->query('DROP TABLE IF EXISTS places_content');
        $this->db->query('DROP TABLE IF EXISTS places');

        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'category' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
            'lat' => [
                'type' => 'DECIMAL(10,6)',
                'null' => false,
            ],
            'lon' => [
                'type' => 'DECIMAL(10,6)',
                'null' => false,
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
            'deleted_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('places', true);

        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'place_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => false,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
            ],
            'locale' => [
                'type'    => 'ENUM("ru", "en")',
                'default' => 'ru',
                'null'    => false,
            ],
            'title' => [
                'type'       => 'VARCHAR',
                'constraint' => 200,
                'null'       => true,
            ],
            'content' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'delta' => [
                'type'       => 'SMALLINT',
                'constraint' => 5,
                'null'       => false,
                'default'    => 0,
            ],
            'created_at DATETIME default current_timestamp',
            'updated_at DATETIME default current_timestamp',
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('places_content', true);
    }

    protected function tearDown(): void
    {
        $this->db->query('DROP TABLE IF EXISTS places_content');
        $this->db->query('DROP TABLE IF EXISTS places');

        parent::tearDown();
    }

    private function createPlace(): string
    {
        $id = bin2hex(random_bytes(6));

        $this->db->table('places')->insert([
            'id'  => $id,
            'lat' => 55.0,
            'lon' => 37.0,
        ]);

        return $id;
    }

    private function createText(string $placeId, string $locale, string $title, string $content): void
    {
        $this->db->table('places_content')->insert([
            'id'       => bin2hex(random_bytes(6)),
            'place_id' => $placeId,
            'locale'   => $locale,
            'title'    => $title,
            'content'  => $content,
        ]);
    }

    public function testReturnsTextsForEveryLocaleThePlaceHas(): void
    {
        $placeId = $this->createPlace();

        $this->createText($placeId, 'ru', 'Название', '<p>Описание места</p>');
        $this->createText($placeId, 'en', 'Name', '<p>Place description</p>');

        $response = $this->get('places/' . $placeId . '/texts');

        $response->assertStatus(200);

        $items = json_decode($response->getJSON(), true)['items'];

        $this->assertCount(2, $items);

        $byLocale = array_column($items, null, 'locale');

        $this->assertArrayHasKey('ru', $byLocale);
        $this->assertArrayHasKey('en', $byLocale);

        $this->assertSame('Название', $byLocale['ru']['title']);
        // Tags are stripped by plainContent() — same rule as GET /places/:id
        $this->assertSame('Описание места', $byLocale['ru']['content']);
        $this->assertSame('Name', $byLocale['en']['title']);
        $this->assertSame('Place description', $byLocale['en']['content']);

        foreach ($items as $item) {
            $this->assertArrayHasKey('locale', $item);
            $this->assertArrayHasKey('title', $item);
            $this->assertArrayHasKey('content', $item);
            $this->assertArrayHasKey('updated', $item);
        }
    }

    public function testDoesNotFallBackToAnotherLocale(): void
    {
        $placeId = $this->createPlace();

        $this->createText($placeId, 'ru', 'Только русский', 'Только русский текст');

        $response = $this->get('places/' . $placeId . '/texts');

        $response->assertStatus(200);

        $items = json_decode($response->getJSON(), true)['items'];

        $this->assertCount(1, $items);
        $this->assertSame('ru', $items[0]['locale']);
    }

    public function testReturns404ForUnknownPlace(): void
    {
        $response = $this->get('places/' . bin2hex(random_bytes(6)) . '/texts');

        $response->assertStatus(404);
    }
}
