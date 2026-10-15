<?php

namespace App\Libraries\Mail;

use CodeIgniter\Email\Email;
use Config\Email as EmailConfig;

/**
 * Sends one EmailMessage over SMTP (settings in Config\Email).
 *
 * Errors carry only the SMTP dialogue, never the message body: bodies hold
 * sign-in links and unsubscribe tokens and must not reach logs or the database.
 */
class Mailer
{
    private Email $email;
    private EmailConfig $config;

    public function __construct(?EmailConfig $config = null)
    {
        $this->config = $config ?? config('Email');
        $this->email  = new Email($this->config);
    }

    /**
     * @throws MailerException
     */
    public function send(EmailMessage $message): void
    {
        $email = $this->email;
        $email->clear(true);

        $email->setFrom($this->config->fromEmail, $this->config->fromName);
        if ($this->config->replyTo !== '') {
            $email->setReplyTo($this->config->replyTo, $this->config->fromName);
        }

        $email->setTo($message->to);
        $email->setSubject($message->subject);
        $email->setMessage($message->html);
        $email->setAltMessage($message->text);

        if ($message->category !== null) {
            $email->setHeader('X-Geometki-Category', $message->category);
        }

        // RFC 3834: automatic mail, so vacation responders do not answer it
        $email->setHeader('Auto-Submitted', 'auto-generated');

        if ($message->unsubscribeUrl !== null) {
            // RFC 2369 + RFC 8058: the mail client's own "Unsubscribe" button, one POST, no page
            $email->setHeader('List-Unsubscribe', '<' . $message->unsubscribeUrl . '>');
            $email->setHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
        }

        if (!$email->send(false)) {
            // An empty include list returns only the SMTP dialogue and error messages
            // (one SMTP command per line: `to: 550 5.1.1 …`)
            $dialogue = trim(html_entity_decode(strip_tags(str_replace(['</pre>', '<br>'], "\n", $email->printDebugger([]))), ENT_QUOTES));
            $dialogue = preg_replace("/\n{2,}/", "\n", str_replace("\r", '', $dialogue));

            throw new MailerException($dialogue !== '' ? $dialogue : 'Unknown mail transport error', self::isPermanent($dialogue));
        }
    }

    /**
     * Whether the server rejected the recipient mailbox itself, so mailing it
     * again is pointless. Only the reply to RCPT TO counts (`to: …` lines of the
     * dialogue), and only the codes about the recipient address: 5.1.1 (no such
     * user), 5.1.2 (no such domain), 5.1.3 (bad address), 5.1.6 (moved), 5.1.10
     * (domain accepts no mail). Sender errors (5.1.7, 5.1.8 at MAIL FROM) and
     * policy or spam rejections (5.7.x) are not about the address.
     */
    public static function isPermanent(string $dialogue): bool
    {
        foreach (preg_split('/\R/', $dialogue) as $line) {
            if (!preg_match('/^\s*to:\s*(.*)$/i', $line, $match)) {
                continue;
            }

            $reply = $match[1];

            if (preg_match('/^55[0-3][ -]5\.1\.(1|2|3|6|10)\b/', $reply)) {
                return true;
            }

            // Servers without enhanced codes, and those that put an unknown mailbox under a
            // policy code (Yandex: "550 5.7.1 No such user!")
            if (preg_match('/^55[03][ -](?!5\.(?!7\.))/', $reply) && preg_match('/no such user|user unknown|mailbox (does not exist|not found|unavailable)|recipient (does not exist|not found|unknown)/i', $reply)) {
                return true;
            }
        }

        return false;
    }
}
