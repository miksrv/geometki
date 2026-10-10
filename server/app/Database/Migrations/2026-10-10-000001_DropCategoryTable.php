<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Categories move out of the database: the set of keys is Config\Categories,
 * their names and texts live in the client. The `category` table goes away;
 * `places.category` stays a plain varchar(50) with its indexes, but no longer
 * a foreign key — the old FK was ON DELETE CASCADE, so dropping a category
 * row would have deleted every place in it.
 *
 * down() recreates the empty table and the FK so the schema can be rolled
 * back; it does not reseed the rows (their content is now in the client).
 */
class DropCategoryTable extends Migration
{
    public function up()
    {
        $this->forge->dropForeignKey('places', 'places_category_foreign');
        $this->forge->dropTable('category', true);
    }

    public function down()
    {
        $this->forge->addField([
            'name'       => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'title_en'   => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'title_ru'   => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'content_en' => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'content_ru' => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
        ]);
        $this->forge->addPrimaryKey('name');
        $this->forge->createTable('category');

        // Rows must exist before the FK can be re-added for places that have a category;
        // re-insert the keys (titles are not known to the server any more)
        $names = config('Categories')->names;
        $this->db->table('category')->insertBatch(array_map(
            static fn (string $name): array => [
                'name' => $name, 'title_en' => $name, 'title_ru' => $name, 'content_en' => null, 'content_ru' => null,
            ],
            $names
        ));

        $this->db->query('ALTER TABLE places ADD CONSTRAINT `places_category_foreign` FOREIGN KEY (`category`) REFERENCES `category` (`name`) ON DELETE CASCADE ON UPDATE CASCADE');
    }
}
