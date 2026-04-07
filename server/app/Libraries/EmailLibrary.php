<?php namespace App\Libraries;

use Exception;

class EmailLibrary extends \Config\Services {
    public \CodeIgniter\Email\Email $email;
    private array $config;

    public function __construct() {
        $this->config = [
            'protocol'   => 'smtp',
            'SMTPHost'   => getenv('smtp.host'),
            'SMTPUser'   => getenv('smtp.user'),
            'SMTPPass'   => getenv('smtp.pass'),
            'SMTPPort'   => (int) getenv('smtp.port'),
            'mailType'   => 'html',
            'SMTPCrypto' => 'ssl',
            'charset'    => 'UTF-8',
            'wordWrap'   => false,
            'wrapChars'  => 0,
            'validate'   => false,
            'CRLF'       => "\r\n",
            'newline'    => "\r\n",
        ];

        $this->email = \Config\Services::email();
        $this->email->initialize($this->config);
    }

    private const SENDER_NAME = 'Geometki';

    public function send(string $mailTo, string $subject, $message): void {
        // Clear previous email state (важно для последовательных отправок)
        $this->email->clear(true);
        $this->email->initialize($this->config);

        $this->email->setFrom(getenv('smtp.mail'), self::SENDER_NAME);
        $this->email->setTo($mailTo);
        $this->email->setSubject($subject);
        $this->email->setMessage($message);

        if (!$this->email->send()) {
            $debugInfo = $this->email->printDebugger(['headers', 'subject', 'body']);
            log_message('error', 'Email send failed: ' . $debugInfo);
            throw new Exception('Failed to send email: ' . $debugInfo);
        }
    }

    public function sendWithAttachment(string $mailTo, string $subject, string $message, ?string $attachmentPath = null): void {
        // Clear previous email state (важно для последовательных отправок)
        $this->email->clear(true);
        $this->email->initialize($this->config);

        $this->email->setFrom(getenv('smtp.mail'), self::SENDER_NAME);
        $this->email->setTo($mailTo);
        $this->email->setSubject($subject);

        // Handle attachment and replace placeholder CID
        if ($attachmentPath !== null) {
            $this->email->attach($attachmentPath);
            $cid = $this->email->setAttachmentCID($attachmentPath);
            $message = str_replace('cid:COVER_IMAGE_CID', 'cid:' . $cid, $message);
        }

        $this->email->setMessage($message);

        if (!$this->email->send()) {
            $debugInfo = $this->email->printDebugger(['headers', 'subject', 'body']);
            log_message('error', 'Email send failed: ' . $debugInfo);
            throw new Exception('Failed to send email: ' . $debugInfo);
        }
    }
}
