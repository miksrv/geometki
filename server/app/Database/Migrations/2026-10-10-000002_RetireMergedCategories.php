<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The niche taxonomy (features/09-place-categories.md): eight keys merge into
 * others. Moves the places and the OSM candidates onto the new keys. The old
 * keys are gone everywhere else: the category landing pages never went live
 * under them, so there is nothing to redirect.
 *
 * The category interests of users_interest_profiles under a retired key are
 * dropped rather than renamed: two old keys may land on one new key, and the
 * (user, type, value) pair is unique. `php spark interests:refresh` rebuilds
 * them from the places.
 *
 * down() is a no-op: a merge cannot be split back (which `engineering` place
 * was a `bridge`?), and the new keys are a superset of the targets anyway.
 */
class RetireMergedCategories extends Migration
{
    /** Retired key => the key that takes its places */
    private const RENAMED = [
        'animals'      => 'museum',
        'bridge'       => 'engineering',
        'construction' => 'engineering',
        'death'        => 'disaster',
        'mine'         => 'industrial',
        'monument'     => 'memorial',
        'nature'       => 'landscape',
        'radiation'    => 'disaster',
    ];

    public function up()
    {
        foreach (self::RENAMED as $old => $new) {
            $this->db->table('places')->where('category', $old)->update(['category' => $new]);
            $this->db->table('osm_candidates')->where('category', $old)->update(['category' => $new]);
        }

        $this->db->table('users_interest_profiles')
            ->where('interest_type', 'category')
            ->whereIn('interest_value', array_keys(self::RENAMED))
            ->delete();
    }

    public function down()
    {
    }
}
