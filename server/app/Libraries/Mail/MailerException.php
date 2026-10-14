<?php

namespace App\Libraries\Mail;

use RuntimeException;

class MailerException extends RuntimeException
{
    /**
     * @param bool $permanent The recipient address is undeliverable (no point in retrying)
     */
    public function __construct(string $message, public readonly bool $permanent = false)
    {
        parent::__construct($message);
    }
}
