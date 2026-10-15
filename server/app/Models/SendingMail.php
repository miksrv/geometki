<?php

namespace App\Models;

use App\Entities\SendingMailEntity;

/**
 * Model for the `sending_mail` table — the outgoing email queue.
 *
 * Status lifecycle: created → process (claimed by a `notifications:send` run)
 * → completed | grouped (sent inside another row's email) | error (out of
 * attempts or undeliverable) | rejected (nothing to send or the recipient
 * turned it off) | expired (not sent in time). A failed attempt goes back to
 * created with a later next_attempt_at. Queue mechanics: QueueRows; what to send:
 * App\Libraries\Mail\MailQueue.
 *
 * Note: the class is intentionally named SendingMail (without the Model suffix)
 * to preserve backward compatibility with the many existing call-sites.
 *
 * @package App\Models
 */
class SendingMail extends ApplicationBaseModel
{
    use QueueRows;

    protected $table            = 'sending_mail';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = SendingMailEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected $allowedFields = [
        'activity_id',
        'user_id',
        'type',
        'status',
        'email',
        'locale',
        'subject',
        'message',
        'sent_email',
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

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    // -------------------------------------------------------------------------
    // Custom query methods
    // -------------------------------------------------------------------------

    /**
     * Apply the SELECT + LEFT JOINs needed for the admin list view.
     *
     * @return static
     */
    public function applyListSelect(): static
    {
        return $this
            ->select(
                'sending_mail.id, sending_mail.activity_id, sending_mail.status,
                sending_mail.email, sending_mail.subject, sending_mail.type, sending_mail.attempts,
                sending_mail.sent_at, sending_mail.group_id,
                sending_mail.created_at, sending_mail.updated_at,
                users.id as user_id, users.name as user_name, users.avatar as user_avatar,
                activity.type as activity_type'
            )
            ->join('users', 'users.id = sending_mail.user_id', 'left')
            ->join('activity', 'activity.id = sending_mail.activity_id', 'left');
    }

    /**
     * Apply the SELECT + LEFT JOINs for the single-record detail view,
     * including the full message body and error fields.
     *
     * @return static
     */
    public function applyDetailSelect(): static
    {
        return $this
            ->select(
                'sending_mail.id, sending_mail.activity_id, sending_mail.status,
                sending_mail.email, sending_mail.subject, sending_mail.message, sending_mail.error,
                sending_mail.type, sending_mail.attempts, sending_mail.sent_at, sending_mail.group_id,
                sending_mail.created_at, sending_mail.updated_at,
                users.id as user_id, users.name as user_name, users.avatar as user_avatar,
                activity.type as activity_type'
            )
            ->join('users', 'users.id = sending_mail.user_id', 'left')
            ->join('activity', 'activity.id = sending_mail.activity_id', 'left');
    }

    /**
     * Apply admin list filters: status, email, and date range.
     *
     * Returns $this for chaining — call on a fresh instance to avoid
     * accumulated Query Builder state.
     *
     * @param string|null $status    Exact status value to filter by.
     * @param string|null $email     Partial email address (LIKE match).
     * @param string|null $dateFrom  Lower bound for created_at (inclusive).
     * @param string|null $dateTo    Upper bound for created_at (inclusive).
     * @return static
     */
    public function applyFilters(
        ?string $status,
        ?string $email,
        ?string $dateFrom,
        ?string $dateTo
    ): static {
        if ($status) {
            $this->where('sending_mail.status', $status);
        }

        if ($email) {
            $this->like('sending_mail.email', $email);
        }

        if ($dateFrom) {
            $this->where('sending_mail.created_at >=', $dateFrom);
        }

        if ($dateTo) {
            $this->where('sending_mail.created_at <=', $dateTo);
        }

        return $this;
    }

    /**
     * Returns global status counters across all records (no filter applied).
     *
     * @return array{total: int, completed: int, error: int, pending: int}
     */
    public function getStats(): array
    {
        $rows = $this
            ->select('status, COUNT(*) as count')
            ->groupBy('status')
            ->findAll();

        $stats = ['total' => 0, 'completed' => 0, 'error' => 0, 'pending' => 0];

        foreach ($rows as $row) {
            $count = (int) $row->count;
            $stats['total'] += $count;

            if ($row->status === 'completed') {
                $stats['completed'] += $count;
            } elseif ($row->status === 'error') {
                $stats['error'] += $count;
            } elseif (in_array($row->status, ['created', 'process'], true)) {
                $stats['pending'] += $count;
            }
        }

        return $stats;
    }
}
