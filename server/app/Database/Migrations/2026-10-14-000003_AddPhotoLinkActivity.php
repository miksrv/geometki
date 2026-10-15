<?php

namespace App\Database\Migrations;

use App\Libraries\FeedLibrary;
use App\Libraries\LevelsLibrary;
use App\Models\UsersModel;
use CodeIgniter\Database\Migration;

/**
 * Linking a PastVu or Wikimedia Commons photo to a place becomes an activity, `photo_link`:
 * it brings a little experience (MODIFIER_PHOTO_LINK) and opens a story of its own in the
 * feed ("linked 3 photos").
 *
 *  - `activity.external_photo_id` points at the linked photo with ON DELETE CASCADE:
 *    unlinking deletes the row, so the event leaves the feed, the place history and the
 *    calendar, the same way a deleted uploaded photo takes its `photo` event along.
 *  - The photos linked before get their events, with the link time and author (links of
 *    deleted users have no author and stay without one), attached to feed stories in time
 *    order — the same stories `feed:rebuild` would build, a `photo_link` story only takes
 *    `photo_link` events. Their authors' experience is recalculated.
 *
 * MySQL commits every DDL statement on its own: each step checks whether it is still
 * needed, and running the migration again finishes a run that failed halfway.
 */
class AddPhotoLinkActivity extends Migration
{
    private const ACTIVITY_TYPES = "'photo','place','rating','edit','cover','comment','visit','bookmark','collection','collection_place'";

    private const FEED_TYPES = "'place','photo','edit','comment','rating','visit','collection','collection_place','achievement','level'";

    public function up()
    {
        $this->db->query('ALTER TABLE `activity` MODIFY `type` ENUM(' . self::ACTIVITY_TYPES . ", 'photo_link') NOT NULL");
        $this->db->query('ALTER TABLE `feed` MODIFY `type` ENUM(' . self::FEED_TYPES . ", 'photo_link') NOT NULL");

        if (!$this->db->fieldExists('external_photo_id', 'activity')) {
            $this->forge->addColumn('activity', [
                'external_photo_id' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 15,
                    'null'       => true,
                    'after'      => 'photo_id',
                ],
            ]);
        }

        if (!isset($this->db->getForeignKeyData('activity')['activity_external_photo_id_foreign'])) {
            $this->db->query(
                'ALTER TABLE `activity` ADD CONSTRAINT `activity_external_photo_id_foreign`
                 FOREIGN KEY (`external_photo_id`) REFERENCES `places_external_photos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE'
            );
        }

        $this->backfill();
    }

    public function down()
    {
        $this->db->table('activity')->where('type', 'photo_link')->delete();
        $this->db->table('feed')->where('type', 'photo_link')->delete();

        if ($this->db->fieldExists('external_photo_id', 'activity')) {
            $this->forge->dropForeignKey('activity', 'activity_external_photo_id_foreign');
            $this->forge->dropColumn('activity', 'external_photo_id');
        }

        $this->db->query('ALTER TABLE `feed` MODIFY `type` ENUM(' . self::FEED_TYPES . ') NOT NULL');
        $this->db->query('ALTER TABLE `activity` MODIFY `type` ENUM(' . self::ACTIVITY_TYPES . ') NOT NULL');
    }

    /**
     * An activity row for every linked photo that has none yet.
     */
    private function backfill(): void
    {
        $links = $this->db->query(
            "SELECT ep.id, ep.place_id, ep.user_id, ep.created_at
               FROM places_external_photos ep
              WHERE ep.user_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM activity a WHERE a.external_photo_id = ep.id)
              ORDER BY ep.created_at ASC, ep.id ASC"
        )->getResult();

        if (empty($links)) {
            return;
        }

        $feed  = new FeedLibrary();
        $users = [];

        foreach ($links as $link) {
            $id = substr(bin2hex(random_bytes(7)), 0, 13);

            $this->db->table('activity')->insert([
                'id'                => $id,
                'type'              => 'photo_link',
                'user_id'           => $link->user_id,
                'place_id'          => $link->place_id,
                'external_photo_id' => $link->id,
                'created_at'        => $link->created_at,
                'updated_at'        => $link->created_at,
            ]);

            $feed->attach($id, 'photo_link', $link->user_id, $link->place_id, null, strtotime($link->created_at));

            $users[$link->user_id] = true;
        }

        $usersModel = new UsersModel();
        $levels     = new LevelsLibrary();

        // Silent: old links must not send "new level" notifications and pushes on deploy
        foreach (array_keys($users) as $userId) {
            $user = $usersModel->getUserById($userId);

            if ($user) {
                $levels->calculate($user, false);
            }
        }
    }
}
