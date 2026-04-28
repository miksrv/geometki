<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class SendingMailEntity extends Entity {
    protected $attributes = [
        'user_id'     => null,
        'activity_id' => null,
        'status'      => 'created',
        'email'       => null,
        'locale'      => 'ru',
        'subject'     => null,
        'message'     => null,
        'sent_email'  => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'user_id'     => 'string',
        'activity_id' => 'string',
        'status'      => 'string',
        'email'       => 'string',
        'locale'      => 'string',
        'subject'     => 'string',
        'message'     => 'string',
        'sent_email'  => 'string',
    ];
}
