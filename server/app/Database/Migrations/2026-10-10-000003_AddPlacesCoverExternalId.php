<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The linked Wikimedia Commons or PastVu photo (places_external_photos.id) the place cover
 * is cut from; NULL when the cover comes from an uploaded photo or there is no cover.
 * The cover caption credits that photo, and removing the last uploaded photo keeps such a cover.
 */
class AddPlacesCoverExternalId extends Migration
{
    public function up()
    {
        $this->forge->addColumn('places', [
            'cover_external_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 15,
                'null'       => true,
                'after'      => 'photos',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('places', 'cover_external_id');
    }
}
