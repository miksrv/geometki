<?php

namespace App\Models;

use App\Entities\SendingMailEntity;

/**
 * Model for the `sending_mail` table.
 *
 * Tracks outbound email jobs: their status lifecycle (created → process →
 * completed / error), the email address, rendered subject and body, and any
 * delivery error message.
 *
 * Note: the class is intentionally named SendingMail (without the Model suffix)
 * to preserve backward compatibility with the many existing call-sites.
 *
 * @package App\Models
 */
class SendingMail extends ApplicationBaseModel
{
    protected $table            = 'sending_mail';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = SendingMailEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected $allowedFields = [
        'activity_id',
        'status',
        'email',
        'locale',
        'subject',
        'message',
        'sent_email',
        'error',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    // No beforeInsert callback: $useAutoIncrement = true, the PK is assigned by
    // the database. generateId() must NOT be registered here as it would try to
    // set a string value on an auto-increment integer column.
    protected $allowCallbacks = false;

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
                sending_mail.email, sending_mail.subject,
                sending_mail.created_at, sending_mail.updated_at,
                users.id as user_id, users.name as user_name, users.avatar as user_avatar,
                activity.type as activity_type'
            )
            ->join('users', 'users.email = sending_mail.email', 'left')
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
                sending_mail.created_at, sending_mail.updated_at,
                users.id as user_id, users.name as user_name, users.avatar as user_avatar,
                activity.type as activity_type'
            )
            ->join('users', 'users.email = sending_mail.email', 'left')
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

    /**
     * Return the most recent sending record for a given email address, filtered
     * by whether it has an associated activity row.
     *
     * @param string $email     The recipient email address.
     * @param bool   $activity  If true, require activity_id IS NOT NULL.
     * @return object|array|null
     */
    public function checkSendLastEmail(string $email, bool $activity = true): object|array|null
    {
        return $this
            ->select('created_at')
            ->where('email', $email)
            ->where($activity ? 'activity_id IS NOT NULL' : 'activity_id IS NULL')
            ->orderBy('created_at', 'DESC')
            ->first();
    }
}
