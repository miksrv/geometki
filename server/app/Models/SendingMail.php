<?php

namespace App\Models;

class SendingMail extends ApplicationBaseModel {
    protected $table            = 'sending_mail';
    protected $primaryKey       = 'id';
    protected $returnType       = \App\Entities\SendingMailEntity::class;
    protected $useAutoIncrement = true;
    protected $useSoftDeletes   = true;

    protected $allowedFields    = [
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

    protected $validationRules      = [];
    protected $validationMessages   = [];
    protected $skipValidation       = false;
    protected $cleanValidationRules = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
    protected $afterInsert    = [];
    protected $beforeUpdate   = [];
    protected $afterUpdate    = [];
    protected $beforeFind     = [];
    protected $afterFind      = [];
    protected $beforeDelete   = [];
    protected $afterDelete    = [];

    /**
     * SELECT + LEFT JOINs needed for the admin list view.
     */
    public function applyListSelect(): static
    {
        return $this
            ->select('sending_mail.id, sending_mail.activity_id, sending_mail.status,
                sending_mail.email, sending_mail.subject,
                sending_mail.created_at, sending_mail.updated_at,
                users.id as user_id, users.name as user_name, users.avatar as user_avatar,
                activity.type as activity_type')
            ->join('users', 'users.email = sending_mail.email', 'left')
            ->join('activity', 'activity.id = sending_mail.activity_id', 'left');
    }

    /**
     * SELECT + LEFT JOINs for single-record detail view (includes full body fields).
     */
    public function applyDetailSelect(): static
    {
        return $this
            ->select('sending_mail.id, sending_mail.activity_id, sending_mail.status,
                sending_mail.email, sending_mail.subject, sending_mail.message, sending_mail.error,
                sending_mail.created_at, sending_mail.updated_at,
                users.id as user_id, users.name as user_name, users.avatar as user_avatar,
                activity.type as activity_type')
            ->join('users', 'users.email = sending_mail.email', 'left')
            ->join('activity', 'activity.id = sending_mail.activity_id', 'left');
    }

    /**
     * Apply admin list filters (status, email, date range).
     * Returns $this for chaining — call on a fresh instance to avoid builder state issues.
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
     * @param string $email
     * @param bool $activity
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
