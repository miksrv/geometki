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
