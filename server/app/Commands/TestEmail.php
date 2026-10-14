<?php

namespace App\Commands;

use App\Libraries\Mail\Mailer;
use App\Libraries\Mail\MailerException;
use App\Libraries\Mail\MailSamples;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Send every kind of email with sample data, to check SMTP and how the
 * emails look in real mail clients:
 *   php spark system:test-email you@example.com
 *   php spark system:test-email you@example.com --locale en --kind digest
 */
class TestEmail extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'system:test-email';
    protected $description = 'Send sample emails to verify SMTP and the templates';
    protected $usage       = 'system:test-email <email> [--locale ru|en] [--kind magic-link|activity|activity-group|digest]';
    protected $arguments   = [
        'email' => 'Email address to send the samples to',
    ];
    protected $options     = [
        '--locale' => 'ru (default) or en',
        '--kind'   => 'Send only this kind',
    ];

    public function run(array $params)
    {
        $email = $params[0] ?? null;

        if (empty($email)) {
            CLI::error('Please provide an email address: php spark system:test-email you@example.com');
            return;
        }

        $config = config('Email');
        CLI::write("SMTP {$config->SMTPHost}:{$config->SMTPPort} ({$config->SMTPCrypto}), user {$config->SMTPUser}, from {$config->fromEmail}", 'white');

        $locale = CLI::getOption('locale') ?: 'ru';
        $kinds  = CLI::getOption('kind') ? [CLI::getOption('kind')] : MailSamples::KINDS;
        $mailer = new Mailer();

        foreach ($kinds as $kind) {
            try {
                $mailer->send(MailSamples::build($kind, $email, $locale));
                CLI::write("{$kind}: sent", 'green');
            } catch (MailerException $e) {
                CLI::error("{$kind}: failed" . ($e->permanent ? ' (address rejected)' : '') . "\n" . $e->getMessage());
            }
        }
    }
}
