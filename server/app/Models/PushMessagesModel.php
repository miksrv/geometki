<?php

namespace App\Models;

/**
 * Model for the `push_messages` table — the push queue (App\Libraries\Push\PushQueue).
 * The queue mechanics are those of the email queue (QueueRows).
 *
 * @package App\Models
 */
class PushMessagesModel extends ApplicationBaseModel
{
    use QueueRows;

    protected $table            = 'push_messages';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'object';
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
        'type',
        'activity_id',
        'notification_id',
        'meta',
        'status',
        'error',
        'attempts',
        'next_attempt_at',
        'locked_by',
        'locked_at',
        'sent_at',
        'group_id',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $skipValidation = true;
    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    /**
     * What became of the user's pushes about these activities, for the email that may
     * stand in for them: 'delivered' (sent, grouped into a sent push, or seen on the
     * site), 'pending' (still queued) or 'failed'; activities without a push are absent.
     *
     * @param string[] $activityIds
     *
     * @return array<string, string> activity id => outcome
     */
    public function outcomesByActivity(string $userId, array $activityIds): array
    {
        if (!$activityIds) {
            return [];
        }

        // The user's own pushes about these events: a push of someone else about the same
        // activity (another recipient) says nothing about this user's email
        $rows = $this->db->table($this->table)
            ->select('activity_id, status, error')
            ->where('user_id', $userId)
            ->whereIn('activity_id', array_values($activityIds))
            ->whereIn('type', config('Notifications')->activityTypes)
            ->where('deleted_at', null)
            ->get()
            ->getResult();

        $outcomes = [];

        foreach ($rows as $row) {
            $outcome = match (true) {
                in_array($row->status, ['completed', 'grouped'], true) => 'delivered',
                in_array($row->status, ['created', 'process'], true)   => 'pending',
                // Seen on the site: the user knows, an email would be a duplicate
                $row->status === 'rejected' && $row->error === \App\Libraries\Push\PushQueue::SEEN_ON_SITE => 'delivered',
                default => 'failed',
            };

            // Delivered wins over pending, pending over failed
            $rank = ['failed' => 0, 'pending' => 1, 'delivered' => 2];

            if (!isset($outcomes[$row->activity_id]) || $rank[$outcome] > $rank[$outcomes[$row->activity_id]]) {
                $outcomes[$row->activity_id] = $outcome;
            }
        }

        return $outcomes;
    }
}
