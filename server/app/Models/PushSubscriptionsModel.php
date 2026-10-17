<?php

namespace App\Models;

/**
 * Model for the `push_subscriptions` table: a browser's push subscription,
 * bound to the user who enabled push on that device. Looked up by
 * `endpoint_hash` (self::hash()).
 *
 * @package App\Models
 */
class PushSubscriptionsModel extends ApplicationBaseModel
{
    protected $table            = 'push_subscriptions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'object';
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
        'endpoint',
        'endpoint_hash',
        'p256dh',
        'auth',
        'content_encoding',
        'timezone',
        'locale',
        'user_agent',
        'failures',
        'last_success_at',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $skipValidation = true;
    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    public static function hash(string $endpoint): string
    {
        return hash('sha256', $endpoint);
    }

    public function findByEndpoint(string $endpoint): ?object
    {
        return $this->where('endpoint_hash', self::hash($endpoint))->first();
    }

    /**
     * The devices of the given users.
     *
     * @param string[] $userIds
     *
     * @return array<string, object[]> user id => subscriptions
     */
    public function forUsers(array $userIds): array
    {
        if (!$userIds) {
            return [];
        }

        $result = [];

        foreach ($this->whereIn('user_id', array_values($userIds))->orderBy('updated_at', 'DESC')->findAll() as $row) {
            $result[$row->user_id][] = $row;
        }

        return $result;
    }

    public function hasAny(string $userId): bool
    {
        return $this->where('user_id', $userId)->countAllResults() > 0;
    }

    public function markSuccess(string $id): void
    {
        $this->db->table($this->table)->where('id', $id)
            ->set('failures', 0)
            ->set('last_success_at', 'NOW()', false)
            ->update();
    }

    public function markFailure(string $id): void
    {
        $this->db->table($this->table)->where('id', $id)->set('failures', 'failures + 1', false)->update();
    }

    /**
     * Delete a device the push service no longer knows (404/410), keeping whose it was:
     * the browser may still renew it (Push::renew()).
     */
    public function expire(object $subscription): void
    {
        $this->db->table('push_subscriptions_expired')->replace([
            'endpoint_hash' => $subscription->endpoint_hash,
            'user_id'       => $subscription->user_id,
            'timezone'      => $subscription->timezone,
            'locale'        => $subscription->locale,
            'user_agent'    => $subscription->user_agent,
            'created_at'    => date('Y-m-d H:i:s'),
        ]);

        $this->delete($subscription->id);
    }

    /**
     * The owner and settings of a device deleted by expire(), while it can be renewed.
     */
    public function findExpired(string $endpoint, int $days): ?object
    {
        return $this->db->table('push_subscriptions_expired')
            ->where('endpoint_hash', self::hash($endpoint))
            ->where('created_at >=', date('Y-m-d H:i:s', strtotime("-{$days} days")))
            ->get()
            ->getRow();
    }

    public function forgetExpired(string $endpoint): void
    {
        $this->db->table('push_subscriptions_expired')->where('endpoint_hash', self::hash($endpoint))->delete();
    }

    /**
     * Expired devices older than $days: their browsers had their chance to renew.
     */
    public function purgeExpired(int $days): int
    {
        $this->db->table('push_subscriptions_expired')
            ->where('created_at <', date('Y-m-d H:i:s', strtotime("-{$days} days")))
            ->delete();

        return $this->db->affectedRows();
    }

    /**
     * Subscriptions that keep failing (the browser was reset, the device is gone
     * but the push service still answers): deleted by the daily cleanup.
     */
    public function deleteFailing(int $maxFailures): int
    {
        $this->db->table($this->table)->where('failures >=', $maxFailures)->delete();

        return $this->db->affectedRows();
    }
}
