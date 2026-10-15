<?php

namespace App\Commands;

use App\Libraries\Mail\MailSamples;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Render every kind of email with sample data into writable/email-preview/
 * to open in a browser:
 *   php spark email:preview
 *   php spark email:preview --locale en
 */
class EmailPreview extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'email:preview';
    protected $description = 'Render every email with sample data into writable/email-preview/';
    protected $usage       = 'email:preview [--locale ru|en]';
    protected $options     = [
        '--locale' => 'ru (default) or en',
    ];

    public function run(array $params)
    {
        $locale = CLI::getOption('locale') ?: 'ru';
        $dir    = WRITEPATH . 'email-preview/';

        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        foreach (MailSamples::KINDS as $kind) {
            $message = MailSamples::build($kind, 'preview@example.com', $locale);
            $base    = $dir . $kind . '.' . $locale;

            file_put_contents($base . '.html', $message->html);
            file_put_contents($base . '.txt', 'Subject: ' . $message->subject . "\n\n" . $message->text);

            CLI::write($base . '.html', 'green');
        }
    }
}
