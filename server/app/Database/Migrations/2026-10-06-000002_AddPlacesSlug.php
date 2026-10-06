<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds a nullable 'slug' column to 'places' for SEO-friendly URLs
 * (/places/{id}-{slug}). The 13-char hex id remains the only unique
 * identifier — slug is cosmetic and intentionally not indexed/unique.
 *
 * Existing rows are left with slug = NULL; run
 *   php spark system:generate-place-slugs
 * once after deploying this migration to backfill them.
 */
class AddPlacesSlug extends Migration {
    public function up()
    {
        $this->forge->addColumn('places', [
            'slug' => [
                'type'       => 'VARCHAR',
                'constraint' => 120,
                'null'       => true,
                'default'    => null,
                'after'      => 'id',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('places', 'slug');
    }
}
