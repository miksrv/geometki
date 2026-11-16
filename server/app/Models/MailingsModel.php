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
}
