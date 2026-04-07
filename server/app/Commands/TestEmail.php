<?php

namespace App\Commands;

use App\Libraries\EmailLibrary;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Exception;

class TestEmail extends BaseCommand
{
    protected $group       = 'system';
    protected $name        = 'system:test-email';
    protected $description = 'Send a test email to verify SMTP configuration';
    protected $usage       = 'system:test-email <email>';
    protected $arguments   = [
        'email' => 'Email address to send test message to',
    ];

    public function run(array $params)
    {
        $email = $params[0] ?? null;

        if (empty($email)) {
            CLI::error('Please provide an email address: php spark system:test-email your@email.com');
            return;
        }

        CLI::write('Testing email configuration...', 'yellow');
        CLI::write('SMTP Host: ' . getenv('smtp.host'), 'white');
        CLI::write('SMTP Port: ' . getenv('smtp.port'), 'white');
        CLI::write('SMTP User: ' . getenv('smtp.user'), 'white');
        CLI::write('From: ' . getenv('smtp.mail'), 'white');
        CLI::newLine();

        // Test 1: Simple text without template
        CLI::write('Test 1: Sending simple HTML without template...', 'yellow');
        try {
            $emailLib = new EmailLibrary();
            $simpleHtml = '<html><body><h1>Test Email</h1><p>This is a simple test without template.</p></body></html>';
            $emailLib->send($email, 'Test 1: Simple HTML', $simpleHtml);
            CLI::write('Test 1: SUCCESS', 'green');
        } catch (Exception $e) {
            CLI::error('Test 1 FAILED: ' . $e->getMessage());
        }

        CLI::newLine();

        // Test 2: Using template with simple message
        CLI::write('Test 2: Sending email using template with simple message...', 'yellow');
        try {
            $emailLib = new EmailLibrary();
            $message = view('email', [
                'message' => '<p>Simple paragraph test</p>',
            ]);
            $emailLib->send($email, 'Test 2: Template with simple text', $message);
            CLI::write('Test 2: SUCCESS', 'green');
        } catch (Exception $e) {
            CLI::error('Test 2 FAILED: ' . $e->getMessage());
        }

        CLI::newLine();

        // Test 3: Template with HTML tags in message
        CLI::write('Test 3: Sending email with HTML tags in message...', 'yellow');
        try {
            $emailLib = new EmailLibrary();
            $htmlMessage = '<h2>Заголовок с кириллицей</h2><p>Текст с <strong>тегами</strong> и <a href="https://geometki.com">ссылкой</a></p>';
            $message = view('email', [
                'message'    => $htmlMessage,
                'preheader'  => 'Превью письма',
                'actionText' => 'Открыть',
                'actionLink' => 'https://geometki.com',
            ]);
            $emailLib->send($email, 'Test 3: Template with HTML content', $message);
            CLI::write('Test 3: SUCCESS', 'green');
        } catch (Exception $e) {
            CLI::error('Test 3 FAILED: ' . $e->getMessage());
        }

        CLI::newLine();

        // Test 4: Real data from database
        CLI::write('Test 4: Testing with real pending emails from database...', 'yellow');
        $sendingEmailModel = new \App\Models\SendingMail();
        $pendingEmails = $sendingEmailModel
            ->select('sending_mail.*, activity.type, activity.place_id')
            ->join('activity', 'activity.id = sending_mail.activity_id', 'left')
            ->where('sending_mail.status', 'created')
            ->limit(3)
            ->findAll();

        if (empty($pendingEmails)) {
            CLI::write('No pending emails in database to test', 'yellow');
        } else {
            foreach ($pendingEmails as $i => $item) {
                CLI::write("  Email #{$i}: type={$item->type}, place_id={$item->place_id}, message_length=" . strlen($item->message ?? ''), 'white');

                // Check for problematic characters
                if ($item->message) {
                    $hasNullBytes = strpos($item->message, "\0") !== false;
                    $hasInvalidUtf8 = !mb_check_encoding($item->message, 'UTF-8');

                    if ($hasNullBytes) {
                        CLI::write("    WARNING: Message contains NULL bytes!", 'red');
                    }
                    if ($hasInvalidUtf8) {
                        CLI::write("    WARNING: Message contains invalid UTF-8!", 'red');
                    }

                    // Show first 200 chars
                    CLI::write("    Preview: " . substr($item->message, 0, 200), 'white');
                }
            }
        }

        CLI::newLine();
        CLI::write('All tests completed!', 'green');
    }
}

