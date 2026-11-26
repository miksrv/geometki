<?php

namespace App\Models;

/**
 * Model for the `mailings` table: the email newsletters of the administrators
 * (App\Libraries\MailingsLibrary, App\Controllers\Mailings).
 *
 * Status: draft → sending → completed, draft | sending → canceled.
 */
class MailingsModel extends ApplicationBaseModel
{
    public const STATUSES = ['draft', 'sending', 'completed', 'canceled'];

    protected $table            = 'mailings';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected $allowedFields = [
        'subject',
        'content',
        'button_label',
        'button_url',
        'image',
        'status',
        'recipients',
        'author_id',
        'sent_at',
        'completed_at',
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
     * Mailings in `sending` whose letters are all done (none waits or is being sent) are
     * `completed`. A mailing is set to `sending` in the same transaction that queues its
     * letters, so one is never completed before its letters exist.
     *
     * @return int how many were completed
     */
    public function completeFinished(): int
    {
        $now = date('Y-m-d H:i:s');

        $this->db->query(
            "UPDATE `mailings` SET `status` = 'completed', `completed_at` = ?, `updated_at` = ?
             WHERE `status` = 'sending' AND `deleted_at` IS NULL
               AND NOT EXISTS (
                   SELECT 1 FROM `sending_mail`
                   WHERE `sending_mail`.`mailing_id` = `mailings`.`id`
                     AND `sending_mail`.`status` IN ('created', 'process')
                     AND `sending_mail`.`deleted_at` IS NULL
               )",
            [$now, $now]
        );

        return $this->db->affectedRows();
    }

    /**
     * Keeps the delivery numbers of the finished mailings (`completed`, `canceled`) whose letters
     * are all done in `delivered` / `failed` / `rejected`, once: the cleanup of the queue
     * deletes the letters later (MailingsLibrary::present() reads the kept numbers then).
     *
     * @return int how many were kept
     */
    public function freezeDelivery(): int
    {
        $this->db->query(
            "UPDATE `mailings`
             LEFT JOIN (
                 SELECT `mailing_id`,
                        SUM(`status` IN ('completed', 'grouped')) AS delivered,
                        SUM(`status` IN ('error', 'expired')) AS failed,
                        SUM(`status` = 'rejected') AS rejected
                 FROM `sending_mail`
                 WHERE `mailing_id` IS NOT NULL AND `deleted_at` IS NULL
                 GROUP BY `mailing_id`
             ) AS counts ON counts.`mailing_id` = `mailings`.`id`
             SET `mailings`.`delivered` = COALESCE(counts.delivered, 0),
                 `mailings`.`failed`    = COALESCE(counts.failed, 0),
                 `mailings`.`rejected`  = COALESCE(counts.rejected, 0)
             WHERE `mailings`.`status` IN ('completed', 'canceled') AND `mailings`.`delivered` IS NULL
               AND `mailings`.`deleted_at` IS NULL
               AND NOT EXISTS (
                   SELECT 1 FROM `sending_mail`
                   WHERE `sending_mail`.`mailing_id` = `mailings`.`id`
                     AND `sending_mail`.`status` IN ('created', 'process')
                     AND `sending_mail`.`deleted_at` IS NULL
               )"
        );

        return $this->db->affectedRows();
    }
}
