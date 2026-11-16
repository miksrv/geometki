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

    /** The filter of the letters in the queue: `created` and `process` together */
    public const PENDING = 'pending';

    /** The types of the bulk mail, sent within the hosting limits */
    public const BULK_TYPES = ['digest', 'news'];

    /** The statuses a row can have: the list's filter takes one of them */
    public const STATUSES = ['created', 'process', 'completed', 'grouped', 'error', 'rejected', 'expired'];

    protected $table            = 'sending_mail';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = SendingMailEntity::class;
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected $allowedFields = [
        'activity_id',
        'mailing_id',
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
     * @param string|null $dateTo    Upper bound for created_at (inclusive); see filterDate() for a bare day.
     * @return static
     */
    public function applyFilters(
        ?string $status,
        ?string $email,
        ?string $dateFrom,
        ?string $dateTo,
        ?bool $bulk = null
    ): static {
        if ($status === self::PENDING) {
            // "In the queue": not sent yet, waiting or being sent — the `pending` of getStats()
            $this->whereIn('sending_mail.status', ['created', 'process']);
        } elseif ($status) {
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

        // The bulk mail (digests, mailings) waits for the hosting limits for days on purpose;
        // `false` leaves only the letters that go out at once
        if ($bulk !== null) {
            $bulk
                ? $this->whereIn('sending_mail.type', self::BULK_TYPES)
                : $this->groupStart()->where('sending_mail.type', null)->orWhereNotIn('sending_mail.type', self::BULK_TYPES)->groupEnd();
        }

        return $this;
    }

    /**
     * A date of a list filter as a moment: a bare day (`Y-m-d`) is its first second for the
     * lower bound and its last for the upper one, so `date_to` includes the whole day; a
     * `Y-m-d H:i:s` stays. Null for anything else (the filter is then ignored).
     */
    public static function filterDate(mixed $value, bool $upper): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        foreach (['Y-m-d' => $upper ? '23:59:59' : '00:00:00', 'Y-m-d H:i:s' => null] as $format => $time) {
            $date = \DateTime::createFromFormat('!' . $format, $value);

            if ($date !== false && $date->format($format) === $value) {
                return $time ? $value . ' ' . $time : $value;
            }
        }

        return null;
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
