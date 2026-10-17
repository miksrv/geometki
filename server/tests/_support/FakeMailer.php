<?php

namespace Tests\Support;

use App\Libraries\Mail\EmailMessage;
use App\Libraries\Mail\Mailer;
use App\Libraries\Mail\MailerException;

/**
 * An SMTP transport that sends nothing: it records the messages, or throws
 * `$failure` when a test sets it.
 */
class FakeMailer extends Mailer
{
    /** @var EmailMessage[] */
    public array $sent = [];

    public ?MailerException $failure = null;

    public function __construct()
    {
    }

    public function send(EmailMessage $message): void
    {
        if ($this->failure) {
            throw $this->failure;
        }

        $this->sent[] = $message;
    }
}
