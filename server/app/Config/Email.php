<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Outgoing mail transport, read by App\Libraries\Mail\Mailer.
 *
 * Filled from the `smtp.*` keys of `.env`:
 *   smtp.mail   — sender address (From)
 *   smtp.host, smtp.port, smtp.user, smtp.pass
 *   smtp.crypto — `ssl` (implicit TLS, port 465; the default), `tls` (STARTTLS) or empty
 *   smtp.replyTo — optional Reply-To address
 */
class Email extends BaseConfig
{
    public string $fromEmail  = '';
    public string $fromName   = 'Geometki';
    public string $replyTo    = '';
    public string $recipients = '';

    public string $userAgent = 'Geometki';
    public string $protocol  = 'smtp';
    public string $mailPath  = '/usr/sbin/sendmail';

    public string $SMTPHost = '';
    public string $SMTPUser = '';
    public string $SMTPPass = '';
    public int $SMTPPort     = 465;
    public int $SMTPTimeout  = 10;
    public bool $SMTPKeepAlive = false;

    /**
     * '', 'tls' (STARTTLS) or 'ssl' (implicit TLS).
     */
    public string $SMTPCrypto = 'ssl';

    public bool $wordWrap  = false;
    public int $wrapChars  = 76;
    public string $mailType = 'html';
    public string $charset  = 'UTF-8';
    public bool $validate   = false;
    public int $priority    = 3;
    public string $CRLF     = "\r\n";
    public string $newline  = "\r\n";
    public bool $BCCBatchMode = false;
    public int $BCCBatchSize  = 200;
    public bool $DSN          = false;

    public function __construct()
    {
        parent::__construct();

        $this->fromEmail  = (string) (env('smtp.mail') ?? $this->fromEmail);
        $this->replyTo    = (string) (env('smtp.replyTo') ?? $this->replyTo);
        $this->SMTPHost   = (string) (env('smtp.host') ?? $this->SMTPHost);
        $this->SMTPUser   = (string) (env('smtp.user') ?? $this->SMTPUser);
        $this->SMTPPass   = (string) (env('smtp.pass') ?? $this->SMTPPass);
        $this->SMTPPort   = (int) (env('smtp.port') ?? $this->SMTPPort);
        $this->SMTPCrypto = (string) (env('smtp.crypto') ?? $this->SMTPCrypto);
    }
}
