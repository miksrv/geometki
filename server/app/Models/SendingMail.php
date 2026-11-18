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

    /** The types of the bulk mail, sent within the hosting limits */
    public const BULK_TYPES = ['digest', 'news'];

    /** A letter whose time to go came longer ago than this and is still waiting: the sending job is not running */
    public const OVERDUE_MINUTES = 30;

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

    /**
     * The state of the queue for the admin dashboard (GET /mail/queue), by the DB clock: letters
     * sent during the last day, letters waiting, the ones of them overdue (their time to go came
     * over OVERDUE_MINUTES ago; the bulk mail is left out, it waits for the hosting limits on
     * purpose) and the letters that failed during the last week.
     *
     * @return array{sent_day: int, pending: int, overdue: int, errors_week: int}
     */
    public function health(): array
    {
        $bulk = "'" . implode("', '", self::BULK_TYPES) . "'";
        $row  = $this->db->query(
            "SELECT
                 SUM(`status` IN ('completed', 'grouped') AND `sent_at` >= DATE_SUB(NOW(), INTERVAL 1 DAY)) AS sent_day,
                 SUM(`status` IN ('created', 'process')) AS pending,
                 SUM(`status` = 'created' AND (`type` IS NULL OR `type` NOT IN ({$bulk}))
                     AND COALESCE(`next_attempt_at`, `created_at`) < DATE_SUB(NOW(), INTERVAL ? MINUTE)) AS overdue,
                 SUM(`status` = 'error' AND `updated_at` >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS errors_week
             FROM `sending_mail`
             WHERE `deleted_at` IS NULL",
            [self::OVERDUE_MINUTES]
        )->getRow();

        return [
            'sent_day'    => (int) ($row->sent_day ?? 0),
            'pending'     => (int) ($row->pending ?? 0),
            'overdue'     => (int) ($row->overdue ?? 0),
            'errors_week' => (int) ($row->errors_week ?? 0),
        ];
    }
}
