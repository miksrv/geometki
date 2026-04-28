<?php

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class CommentEntity extends Entity {
    protected $attributes = [
        'id'        => null,
        'place_id'  => null,
        'user_id'   => null,
        'answer_id' => null,
        'content'   => null,
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    protected $casts = [
        'id'        => 'string',
        'place_id'  => 'string',
        'user_id'   => 'string',
        'answer_id' => 'string',
        'content'   => 'string',
    ];
}
