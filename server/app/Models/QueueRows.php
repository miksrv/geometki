<?php

namespace App\Models;

use CodeIgniter\Database\BaseBuilder;

/**
 * The queue mechanics shared by the email queue (`sending_mail`) and the push
 * queue (`push_messages`): rows go created → process (claimed by one
 * `notifications:send` run) → completed | grouped | error | rejected | expired.
 * A failed attempt goes back to created with a later next_attempt_at. Every
 * state change touches only the rows the calling run still holds.
 *
 * The table needs: id, user_id, activity_id, status, error, attempts,
 * next_attempt_at, locked_by, locked_at, sent_at, group_id, created_at,
 * updated_at, deleted_at.
 */
trait QueueRows
{
    /**
     * Claim up to $limit ready rows for the run $token, oldest first, and return
     * every row the run holds (a run may claim in several calls). Atomic:
     * overlapping runs never claim the same row.
     *
     * @param string[] $types   Only rows of these types; with $exclude, all but these
     * @param bool     $exclude
     *
     * @return object[] the rows the run holds
     */
    public function claim(string $token, int $limit, array $types = [], bool $exclude = false): array
    {
        if ($limit > 0) {
            $this->db->query(
                "UPDATE `{$this->table}`
                 SET `status` = 'process', `locked_by` = ?, `locked_at` = NOW()
                 WHERE `status` = 'created' AND `deleted_at` IS NULL
                   AND (`next_attempt_at` IS NULL OR `next_attempt_at` <= NOW())
                   " . $this->typeCondition($types, $exclude) . "
                 ORDER BY `created_at` ASC
                 LIMIT " . (int) $limit,
                [$token]
            );
        }

        return $this->where('locked_by', $token)->where('status', 'process')->orderBy('created_at', 'ASC')->findAll();
    }

    /**
     * `AND …` limiting rows to (or, with $exclude, away from) the given types; '' for none.
     *
     * @param string[] $types
     */
    private function typeCondition(array $types, bool $exclude): string
    {
        if (!$types) {
            return '';
        }

        $list = implode(', ', array_map(fn (string $type) => $this->db->escape($type), $types));

        return $exclude
            ? "AND (`type` IS NULL OR `type` NOT IN ({$list}))"
            : "AND `type` IN ({$list})";
    }

    /**
     * Rows still `created` that were queued before $cutoff (PHP clock, like
     * created_at) will not be sent any more: `expired`.
     *
     * @param string[] $types Only rows of these types; with $exclude, all but these
     */
    public function expireCreatedBefore(string $cutoff, array $types = [], bool $exclude = false): int
    {
        $this->db->query(
            "UPDATE `{$this->table}` SET `status` = 'expired', `updated_at` = NOW()
             WHERE `status` = 'created' AND `deleted_at` IS NULL AND `created_at` < ?
             " . $this->typeCondition($types, $exclude),
            [$cutoff]
        );

        return $this->db->affectedRows();
    }

    /**
     * Give back the rows of a run that died mid-way (claimed over $minutes ago).
     * Dying counts as an attempt: a row that kills the worker every time ends in
     * `error` after $maxAttempts instead of blocking batches until it expires.
     */
    public function releaseStale(int $minutes, int $maxAttempts): int
    {
        $this->db->query(
            "UPDATE `{$this->table}`
             SET `status` = IF(`attempts` + 1 >= ?, 'error', 'created'),
                 `error` = IF(`attempts` + 1 >= ?, 'The sending run died on this message', `error`),
                 `attempts` = `attempts` + 1,
                 `locked_by` = NULL, `locked_at` = NULL, `updated_at` = NOW()
             WHERE `status` = 'process' AND `locked_at` < DATE_SUB(NOW(), INTERVAL ? MINUTE)",
            [$maxAttempts, $maxAttempts, $minutes]
        );

        return $this->db->affectedRows();
    }

    /**
     * Rows of the run $token it did not get to: back to the queue, no attempt spent.
     */
    public function releaseRun(string $token): int
    {
        $this->db->query(
            "UPDATE `{$this->table}` SET `status` = 'created', `locked_by` = NULL, `locked_at` = NULL
             WHERE `status` = 'process' AND `locked_by` = ?",
            [$token]
        );

        return $this->db->affectedRows();
    }

    /**
     * Messages sent in the last $minutes plus the ones runs hold right now (for
     * the hosting limits); only of $type when given.
     */
    public function countSentSince(int $minutes, ?string $type = null): int
    {
        $types = $type !== null ? $this->typeCondition([$type], false) : '';

        return (int) $this->db->query(
            "SELECT COUNT(*) AS cnt FROM `{$this->table}`
             WHERE ((`status` = 'completed' AND `sent_at` >= DATE_SUB(NOW(), INTERVAL ? MINUTE)) OR `status` = 'process')
             {$types}",
            [$minutes]
        )->getRow()->cnt;
    }

    /**
     * While the interval after the user's last message about activity runs,
     * the time it ends (DB clock); null when the next one may go now.
     */
    public function activityIntervalEndsAt(string $userId, int $minutes): ?string
    {
        $row = $this->db->query(
            "SELECT DATE_ADD(MAX(`sent_at`), INTERVAL ? MINUTE) AS ends_at FROM `{$this->table}`
             WHERE `user_id` = ? AND `status` = 'completed' AND `activity_id` IS NOT NULL
             HAVING ends_at > NOW()",
            [$minutes, $userId]
        )->getRow();

        return $row?->ends_at ?: null;
    }

    /**
     * The rows of the run $token among $ids: every state change below touches
     * only them, so a run whose lock was taken over cannot overwrite the result
     * of the run that took it.
     *
     * @param string[] $ids
     */
    protected function ownRows(array $ids, string $token): BaseBuilder
    {
        return $this->db->table($this->table)
            ->whereIn('id', $ids)
            ->where('locked_by', $token)
            ->where('status', 'process');
    }

    /**
     * Put claimed rows back in the queue until $at (no attempt spent).
     *
     * @param string[] $ids
     */
    public function deferUntil(array $ids, string $token, string $at): void
    {
        if (!$ids) {
            return;
        }

        $this->ownRows($ids, $token)
            ->update(['status' => 'created', 'locked_by' => null, 'locked_at' => null, 'next_attempt_at' => $at]);
    }

    /**
     * Put claimed rows back in the queue for $seconds (DB clock), no attempt spent.
     *
     * @param string[] $ids
     */
    public function deferForSeconds(array $ids, string $token, int $seconds): void
    {
        if (!$ids) {
            return;
        }

        $this->ownRows($ids, $token)
            ->set('status', 'created')
            ->set('locked_by', null)
            ->set('locked_at', null)
            ->set('next_attempt_at', 'DATE_ADD(NOW(), INTERVAL ' . max(0, $seconds) . ' SECOND)', false)
            ->update();
    }

    /**
     * $mainId was sent; $groupedIds went out inside its email.
     *
     * @param string[]             $groupedIds
     * @param array<string, mixed> $extra Other columns of the sent row (an email's subject)
     *
     * @return bool false when the run no longer owned the row (its lock was taken over)
     */
    public function markSent(string $mainId, string $token, array $groupedIds = [], array $extra = []): bool
    {
        $builder = $this->ownRows([$mainId], $token)
            ->set('status', 'completed')
            ->set('error', null)
            ->set('locked_by', null)
            ->set('locked_at', null)
            ->set('attempts', 'attempts + 1', false)
            ->set('sent_at', 'NOW()', false)
            ->set('updated_at', 'NOW()', false);

        foreach ($extra as $field => $value) {
            $builder->set($field, $value);
        }

        $builder->update();
        $owned = $this->db->affectedRows() > 0;

        if ($groupedIds) {
            $this->ownRows($groupedIds, $token)
                ->set('status', 'grouped')
                ->set('group_id', $mainId)
                ->set('locked_by', null)
                ->set('locked_at', null)
                ->set('sent_at', 'NOW()', false)
                ->set('updated_at', 'NOW()', false)
                ->update();
        }

        return $owned;
    }

    /**
     * A failed attempt of these rows: back to the queue in $retryMinutes, or
     * `error` when $retryMinutes is null (out of attempts or undeliverable).
     *
     * @param string[] $ids
     */
    public function markFailed(array $ids, string $token, string $error, ?int $retryMinutes): void
    {
        if (!$ids) {
            return;
        }

        $builder = $this->ownRows($ids, $token)
            // TEXT holds 65535 bytes, not characters
            ->set('error', mb_strcut($error, 0, 60000))
            ->set('locked_by', null)
            ->set('locked_at', null)
            ->set('attempts', 'attempts + 1', false)
            ->set('updated_at', 'NOW()', false);

        if ($retryMinutes === null) {
            $builder->set('status', 'error');
        } else {
            $builder->set('status', 'created')
                ->set('next_attempt_at', 'DATE_ADD(NOW(), INTERVAL ' . (int) $retryMinutes . ' MINUTE)', false);
        }

        $builder->update();
    }

    /**
     * Rows that went out with another row's failed email: back to the queue in
     * $retryMinutes without spending an attempt of their own.
     *
     * @param string[] $ids
     */
    public function requeue(array $ids, string $token, int $retryMinutes): void
    {
        if (!$ids) {
            return;
        }

        $this->ownRows($ids, $token)
            ->set('status', 'created')
            ->set('locked_by', null)
            ->set('locked_at', null)
            ->set('next_attempt_at', 'DATE_ADD(NOW(), INTERVAL ' . (int) $retryMinutes . ' MINUTE)', false)
            ->update();
    }

    /**
     * Nothing to send (or the recipient turned it off): `rejected` with the reason.
     *
     * @param string[] $ids
     */
    public function markRejected(array $ids, string $token, string $reason): void
    {
        if (!$ids) {
            return;
        }

        $this->ownRows($ids, $token)
            ->set('status', 'rejected')
            ->set('error', $reason)
            ->set('locked_by', null)
            ->set('locked_at', null)
            ->set('updated_at', 'NOW()', false)
            ->update();
    }

    /** Rows deleted per statement by purgeOlderThan(): short locks on a big table */
    private int $purgeChunk = 5000;

    /**
     * Hard-delete rows older than $days days that are done with (PHP clock, like
     * created_at), a chunk at a time.
     */
    public function purgeOlderThan(int $days): int
    {
        $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        $total  = 0;

        do {
            $this->db->query(
                "DELETE FROM `{$this->table}`
                 WHERE `created_at` < ? AND `status` NOT IN ('created', 'process')
                 LIMIT {$this->purgeChunk}",
                [$cutoff]
            );

            $deleted = $this->db->affectedRows();
            $total  += $deleted;
        } while ($deleted >= $this->purgeChunk);

        return $total;
    }

    /**
     * Rows still `created` that were queued more than $hours ago by the database clock
     * (for tables whose created_at is the column default, not PHP time).
     */
    public function expireOlderThanHours(int $hours): int
    {
        $this->db->query(
            "UPDATE `{$this->table}` SET `status` = 'expired', `updated_at` = NOW()
             WHERE `status` = 'created' AND `deleted_at` IS NULL AND `created_at` < DATE_SUB(NOW(), INTERVAL ? HOUR)",
            [$hours]
        );

        return $this->db->affectedRows();
    }
}
