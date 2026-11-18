<?php

require_once __DIR__ . '/../_support/UploadFunctions.php';

use App\Libraries\Mail\MailQueue;
use App\Libraries\Mail\UnsubscribeToken;
use App\Models\MailingsModel;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;
use Config\Notifications;
use Tests\Support\FakeMailer;
use Tests\Support\MySqlTestCase;

/**
 * The mailings of the administrators: the admin API, the audience, the queueing, the letters the
 * email queue renders from the mailing, the cancel and the hosting limits shared with the digests.
 *
 * @internal
 */
final class MailingsTest extends MySqlTestCase
{
    use FeatureTestTrait;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    private FakeMailer $mailer;

    /** @var string[] */
    private array $folders = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->mailer = new FakeMailer();

        $this->createUser('admin1', ['role' => 'admin', 'locale' => 'ru']);
        $this->createUser('user1', ['locale' => 'ru']);
        $this->createUser('user2', ['locale' => 'en']);
    }

    protected function tearDown(): void
    {
        foreach ($this->folders as $id) {
            foreach (glob(FCPATH . 'uploads/mailings/' . $id . '/*') ?: [] as $file) {
                @unlink($file);
            }

            @rmdir(FCPATH . 'uploads/mailings/' . $id);
        }

        $this->folders = [];

        service('superglobals')->setFilesArray([]);

        parent::tearDown();
    }

    // ------------------------------------------------------------------ the guard

    public function testOnlyAnAdministratorMayUseIt(): void
    {
        $id = $this->draft();

        $calls = fn () => [
            $this->get('mailings/manage'),
            $this->get("mailings/manage/{$id}"),
            $this->get('mailings/audience'),
            $this->json('post', 'mailings', ['subject' => 'S', 'content' => 'C']),
            $this->json('patch', "mailings/{$id}", ['subject' => 'S2']),
            $this->delete("mailings/{$id}"),
            $this->post("mailings/{$id}/image"),
            $this->delete("mailings/{$id}/image"),
            $this->json('post', 'mailings/preview', []),
            $this->post("mailings/{$id}/test"),
            $this->post("mailings/{$id}/send"),
            $this->post("mailings/{$id}/cancel"),
        ];

        foreach ($calls() as $response) {
            $response->assertStatus(401);
        }

        $this->signIn('user1');

        foreach ($calls() as $response) {
            $response->assertStatus(403);
        }

        $this->assertSame('draft', $this->mailing($id)->status);
        $this->assertSame(0, $this->db->table('sending_mail')->countAllResults());
    }

    // ------------------------------------------------------------------ the draft

    public function testADraftIsCreatedChangedAndDeleted(): void
    {
        $this->signIn('admin1');

        $created = $this->json('post', 'mailings', ['subject' => '  Новости  ', 'content' => 'Текст', 'button_label' => '']);
        $created->assertStatus(201);
        $body = json_decode($created->getJSON(), true);

        $this->assertSame('draft', $body['status']);
        $this->assertSame('Новости', $body['subject']);
        $this->assertNull($body['button_label'], 'an empty optional field is null');
        $this->assertArrayNotHasKey('subject_en', $body, 'a mailing is in Russian only');
        $this->assertSame(['id' => 'admin1', 'name' => 'User admin1'], $body['author']);
        $this->assertSame(['sent' => 0, 'pending' => 0, 'failed' => 0, 'rejected' => 0], $body['delivery']);
        $this->assertSame(0, $body['recipients']);
        $this->assertNull($body['image']);

        // Only what is sent changes
        $changed = json_decode($this->json('patch', "mailings/{$body['id']}", ['subject' => 'Новости сайта'])->getJSON(), true);

        $this->assertSame('Текст', $changed['content']);
        $this->assertSame('Новости сайта', $changed['subject']);

        $this->json('patch', 'mailings/nothere', ['subject' => 'S'])->assertStatus(404);

        $this->delete("mailings/{$body['id']}")->assertStatus(200);
        $this->get("mailings/manage/{$body['id']}")->assertStatus(404);
    }

    public function testValidation(): void
    {
        $this->signIn('admin1');

        $answer = fn (array $body) => json_decode($this->json('post', 'mailings', $body)->getJSON(), true)['messages'] ?? [];
        $valid  = ['subject' => 'S', 'content' => 'C'];

        $this->assertArrayHasKey('subject', $answer(['content' => 'C']));
        $this->assertArrayHasKey('content', $answer(['subject' => 'S']));
        $this->assertArrayHasKey('subject', $answer(['subject' => str_repeat('я', 201), 'content' => 'C']));
        $this->assertArrayHasKey('content', $answer(['subject' => 'S', 'content' => str_repeat('я', 20001)]));
        $this->assertArrayHasKey('button_label', $answer($valid + ['button_label' => str_repeat('a', 61)]));
        $this->assertArrayHasKey('subject', $answer(['subject' => ['x'], 'content' => 'C']));

        // A url needs a label (the Russian one) and must be http(s) or a site path
        $this->assertArrayHasKey('button_label', $answer($valid + ['button_url' => '/game']));
        $this->assertArrayHasKey('button_url', $answer($valid + ['button_url' => 'javascript:alert(1)', 'button_label' => 'Go']));
        $this->assertArrayHasKey('button_url', $answer($valid + ['button_url' => '//evil.example', 'button_label' => 'Go']));
        $this->assertArrayHasKey('button_url', $answer($valid + ['button_url' => 'https://example.com/' . str_repeat('a', 500), 'button_label' => 'Go']));
        $this->assertArrayNotHasKey('button_url', $answer($valid + ['button_url' => 'https://example.com', 'button_label' => 'Go']));

        $this->assertSame(1, $this->db->table('mailings')->countAllResults(), 'only the valid one was made');
    }

    public function testOnlyADraftChanges(): void
    {
        $this->signIn('admin1');

        foreach (['sending', 'completed', 'canceled'] as $status) {
            $id = $this->draft(['status' => $status]);

            $this->json('patch', "mailings/{$id}", ['subject' => 'New'])->assertStatus(409);
            $this->delete("mailings/{$id}")->assertStatus(409);
            $this->post("mailings/{$id}/send")->assertStatus(409);
            $this->delete("mailings/{$id}/image")->assertStatus(409);
            $this->assertSame('Тема', $this->mailing($id)->subject);
        }
    }

    public function testTheListHasViewsAndStats(): void
    {
        $this->signIn('admin1');

        $this->draft(['created_at' => '2026-01-01 10:00:00']);
        $this->draft(['status' => 'completed', 'created_at' => '2026-01-02 10:00:00']);
        $newest = $this->draft(['status' => 'draft', 'created_at' => '2026-01-03 10:00:00']);

        $all = json_decode($this->get('mailings/manage')->getJSON(), true);

        $this->assertSame(3, $all['count']);
        $this->assertSame($newest, $all['items'][0]['id'], 'newest first');
        $this->assertSame(['total' => 3, 'draft' => 2, 'sending' => 0, 'completed' => 1, 'canceled' => 0], $all['stats']);

        $drafts = json_decode($this->get('mailings/manage?status=draft&limit=1&page=2')->getJSON(), true);

        $this->assertSame(2, $drafts['count']);
        $this->assertCount(1, $drafts['items']);
    }

    // ------------------------------------------------------------------ the audience and the sending

    public function testTheAudienceFollowsTheEmailRules(): void
    {
        $this->audienceUsers();
        $this->signIn('admin1');

        // admin1, user1 (ru), user2 (en): not the one who turned it off, the bounced, the service one, the invalid
        $this->assertSame(['total' => 3], json_decode($this->get('mailings/audience')->getJSON(), true));
    }

    public function testSendingQueuesTheLettersAndTheQueueSendsThem(): void
    {
        $this->audienceUsers();
        $this->signIn('admin1');

        $id = $this->draft(['button_label' => 'Открыть', 'button_url' => '/game']);

        $sent = json_decode($this->post("mailings/{$id}/send")->getJSON(), true);

        $this->assertSame('sending', $sent['status']);
        $this->assertSame(3, $sent['recipients']);
        $this->assertNotNull($sent['sent_at']);
        $this->assertSame(3, $sent['delivery']['pending']);

        $rows = $this->db->table('sending_mail')->where('mailing_id', $id)->get()->getResult();

        $this->assertCount(3, $rows);

        foreach ($rows as $row) {
            $this->assertSame('news', $row->type);
            $this->assertSame('created', $row->status);
            $this->assertNull($row->message, 'the letter is rendered when it is sent');
            $this->assertSame('ru', $row->locale, 'a mailing is in Russian only');
        }

        // A second tap finds it sending
        $this->post("mailings/{$id}/send")->assertStatus(409);
        $this->assertSame(3, $this->db->table('sending_mail')->countAllResults());

        $stats = (new MailQueue($this->mailer))->process();

        $this->assertSame(3, $stats['sent']);
        $this->assertCount(3, $this->mailer->sent);

        $byAddress = [];
        foreach ($this->mailer->sent as $message) {
            $byAddress[$message->to] = $message;
        }

        $this->assertSame('Тема', $byAddress['user1@example.com']->subject);
        $this->assertStringContainsString('Привет, <strong>мир</strong>', $byAddress['user1@example.com']->html);
        // A user with the English site gets the same Russian letter, with Russian links
        $this->assertSame('Тема', $byAddress['user2@example.com']->subject);
        $this->assertStringContainsString('Привет, <strong>мир</strong>', $byAddress['user2@example.com']->html);
        $this->assertMatchesRegularExpression('#href="https?://[^"/]+/game"#', $byAddress['user2@example.com']->html);
        $this->assertStringNotContainsString('/en/', $byAddress['user2@example.com']->html);
        $this->assertSame('news', $byAddress['user1@example.com']->category);

        // The unsubscribe link is a `news` token of the recipient
        $this->assertNotNull($byAddress['user1@example.com']->unsubscribeUrl);
        preg_match('/token=([^&]+)/', $byAddress['user1@example.com']->unsubscribeUrl, $match);
        $this->assertSame(['userId' => 'user1', 'type' => 'news'], (new UnsubscribeToken())->parse(rawurldecode($match[1])));

        // The queue closed the mailing
        $done = json_decode($this->get("mailings/manage/{$id}")->getJSON(), true);

        $this->assertSame('completed', $done['status']);
        $this->assertNotNull($done['completed_at']);
        $this->assertSame(3, $done['delivery']['sent']);
        $this->assertSame(0, $done['delivery']['pending']);
    }

    public function testAMailingIsCompletedWhenTheLastLetterIsDoneEvenWhenItWasRejected(): void
    {
        $this->signIn('admin1');

        $id = $this->draft();
        $this->post("mailings/{$id}/send")->assertStatus(200);

        // user1 turns the news off after the send: the row is rejected at send time
        $this->db->table('users')->where('id', 'user1')->update(['settings' => json_encode(['emailNews' => false])]);

        (new MailQueue($this->mailer))->process();

        $this->assertSame('completed', $this->mailing($id)->status);
        $this->assertSame(['admin1@example.com', 'user2@example.com'], $this->sentTo());
        $this->assertSame('rejected', $this->db->table('sending_mail')->where('user_id', 'user1')->get()->getRow()->status);

        $done = json_decode($this->get("mailings/manage/{$id}")->getJSON(), true);

        $this->assertSame(['sent' => 2, 'pending' => 0, 'failed' => 0, 'rejected' => 1], $done['delivery']);
    }

    public function testNobodyToSendToIsA400AndLeavesTheDraft(): void
    {
        $this->db->table('users')->update(['settings' => json_encode(['emailNews' => false])]);
        $this->signIn('admin1');

        $id = $this->draft();

        $this->post("mailings/{$id}/send")->assertStatus(400);

        $this->assertSame('draft', $this->mailing($id)->status);
        $this->assertSame(0, $this->db->table('sending_mail')->countAllResults());
    }

    // ------------------------------------------------------------------ cancel

    public function testCancelDropsTheWaitingLettersAndKeepsTheSentOnes(): void
    {
        $this->signIn('admin1');

        $id = $this->draft();
        $this->post("mailings/{$id}/send")->assertStatus(200);

        // One of three went out already
        $this->db->table('sending_mail')->where('user_id', 'user1')->update(['status' => 'completed', 'sent_at' => date('Y-m-d H:i:s')]);

        $canceled = json_decode($this->post("mailings/{$id}/cancel")->getJSON(), true);

        $this->assertSame('canceled', $canceled['status']);
        $this->assertSame(['sent' => 1, 'pending' => 0, 'failed' => 0, 'rejected' => 2], $canceled['delivery']);
        $this->assertSame('The mailing was canceled', $this->db->table('sending_mail')->where('user_id', 'user2')->get()->getRow()->error);

        (new MailQueue($this->mailer))->process();

        $this->assertSame([], $this->mailer->sent);

        // Again: nothing changes
        $this->post("mailings/{$id}/cancel")->assertStatus(200);
        $this->assertSame('canceled', $this->mailing($id)->status);
    }

    public function testALetterAQueueRunHoldsIsDroppedWhenItsMailingIsCanceled(): void
    {
        $this->signIn('admin1');

        $id = $this->draft();
        $this->post("mailings/{$id}/send")->assertStatus(200);

        // The cancel came while a run held the rows: they were not `created` any more
        $this->db->table('mailings')->where('id', $id)->update(['status' => 'canceled']);

        (new MailQueue($this->mailer))->process();

        $this->assertSame([], $this->mailer->sent);
        $this->assertSame(3, $this->db->table('sending_mail')->where('status', 'rejected')->countAllResults());
    }

    public function testACancelInTheMiddleOfARunStopsItsNextLetters(): void
    {
        $this->signIn('admin1');

        $id = $this->draft();
        $this->post("mailings/{$id}/send")->assertStatus(200);

        // The administrator cancels right after the run sent its first letter
        $db     = $this->db;
        $mailer = new class ($db, $id) extends FakeMailer {
            public function __construct(private $db, private string $mailingId)
            {
            }

            public function send(\App\Libraries\Mail\EmailMessage $message): void
            {
                parent::send($message);
                $this->db->table('mailings')->where('id', $this->mailingId)->update(['status' => 'canceled']);
            }
        };

        (new MailQueue($mailer))->process();

        $this->assertCount(1, $mailer->sent);
        $this->assertSame(2, $this->db->table('sending_mail')->where('status', 'rejected')->countAllResults());
    }

    public function testAFinishedMailingKeepsItsNumbersAfterTheCleanupDeletesItsLetters(): void
    {
        $this->signIn('admin1');

        $id = $this->draft();
        $this->post("mailings/{$id}/send")->assertStatus(200);

        // While it is being sent the numbers come from the queue, nothing is kept yet
        $this->db->table('sending_mail')->where('user_id', 'user1')->update(['status' => 'completed', 'sent_at' => date('Y-m-d H:i:s')]);
        (new MailingsModel())->freezeDelivery();
        $this->assertNull($this->mailing($id)->delivered);

        $this->db->table('sending_mail')->where('user_id', 'user2')->update(['status' => 'error']);
        $this->db->table('sending_mail')->where('user_id', 'admin1')->update(['status' => 'rejected']);
        (new MailQueue($this->mailer))->process();

        $this->assertSame('completed', $this->mailing($id)->status);
        $this->assertSame(1, (int) $this->mailing($id)->delivered);

        // The cleanup deletes the letters: the mailing still tells how it went
        $this->db->table('sending_mail')->where('mailing_id', $id)->update(['created_at' => date('Y-m-d H:i:s', strtotime('-30 days'))]);
        (new \App\Models\SendingMail())->purgeOlderThan(config('Notifications')->retentionDays);
        $this->assertSame(0, $this->db->table('sending_mail')->countAllResults());

        $shown = json_decode($this->get("mailings/manage/{$id}")->getJSON(), true);
        $this->assertSame(['sent' => 1, 'pending' => 0, 'failed' => 1, 'rejected' => 1], $shown['delivery']);
    }

    public function testACompletedMailingCannotBeCanceled(): void
    {
        $this->signIn('admin1');

        $this->post('mailings/' . $this->draft(['status' => 'completed']) . '/cancel')->assertStatus(409);

        // A draft can be canceled
        $id = $this->draft();
        $this->post("mailings/{$id}/cancel")->assertStatus(200);
        $this->assertSame('canceled', $this->mailing($id)->status);
    }

    public function testCancelOfTheLastWaitingLetterOfAFinishedMailingIsAConflict(): void
    {
        $this->signIn('admin1');

        $id = $this->draft(['status' => 'sending']);
        $this->db->table('sending_mail')->insert([
            'id' => 'm1', 'mailing_id' => $id, 'user_id' => 'user1', 'type' => 'news', 'status' => 'completed',
            'email' => 'user1@example.com', 'locale' => 'ru', 'sent_at' => date('Y-m-d H:i:s'),
        ]);

        // Nothing waits: it is completed, whatever the queue run has done yet
        $this->post("mailings/{$id}/cancel")->assertStatus(409);
        $this->assertSame('completed', $this->mailing($id)->status);
    }

    // ------------------------------------------------------------------ the hosting limits

    public function testMailingLettersShareTheLimitsWithDigests(): void
    {
        $id = $this->draft(['status' => 'sending']);

        // A digest went out within the hour already
        $this->db->table('sending_mail')->insert([
            'id' => 'dig1', 'user_id' => 'user1', 'type' => 'digest', 'status' => 'completed', 'email' => 'user1@example.com',
            'locale' => 'ru', 'subject' => 'Digest', 'message' => '<p>x</p>', 'sent_at' => date('Y-m-d H:i:s'),
        ]);

        foreach (['admin1', 'user1', 'user2'] as $index => $user) {
            $this->db->table('sending_mail')->insert([
                'id' => 'news' . $index, 'mailing_id' => $id, 'user_id' => $user, 'type' => 'news', 'status' => 'created',
                'email' => $user . '@example.com', 'locale' => 'ru', 'created_at' => date('Y-m-d H:i:s', time() - 10 + $index),
            ]);
        }

        $config                  = new Notifications();
        $config->digestHourLimit = 3;

        $stats = (new MailQueue($this->mailer, null, $config))->process();

        // 3 an hour, one used by the digest: two letters of the mailing
        $this->assertSame(2, $stats['sent']);
        $this->assertSame(2, $this->db->table('sending_mail')->where('type', 'news')->where('status', 'completed')->countAllResults());
        $this->assertSame('created', $this->db->table('sending_mail')->where('id', 'news2')->get()->getRow()->status, 'the rest waits for the next runs');
        $this->assertSame('sending', $this->mailing($id)->status, 'while letters wait, it is not completed');

        // A queued letter older than its expiry goes `expired`
        $this->db->table('sending_mail')->where('id', 'news2')->update(['created_at' => date('Y-m-d H:i:s', strtotime('-7 days'))]);
        (new MailQueue($this->mailer, null, $config))->process();

        $this->assertSame('expired', $this->db->table('sending_mail')->where('id', 'news2')->get()->getRow()->status);
        $this->assertSame('completed', $this->mailing($id)->status);

        $done = $this->db->table('mailings')->where('id', $id)->get()->getRow();
        $this->assertNotNull($done->completed_at);
    }

    // ------------------------------------------------------------------ the preview and the test

    public function testThePreviewRendersTheUnsavedForm(): void
    {
        $this->signIn('admin1');

        $id = $this->draft();
        $this->upload("mailings/{$id}/image", $this->png(), 'image/png')->assertStatus(200);
        $image = $this->mailing($id)->image;

        $form = ['id' => $id, 'subject' => 'Не сохранено', 'content' => "Строка **один**\n\n[ссылка](/quests)", 'button_label' => 'Жми', 'button_url' => 'https://example.com'];

        $preview = json_decode($this->json('post', 'mailings/preview', $form)->getJSON(), true);

        $this->assertSame('Не сохранено', $preview['subject']);
        $this->assertStringContainsString('<strong>один</strong>', $preview['html']);
        $this->assertStringContainsString($image, $preview['html'], 'the picture is the saved one');
        $this->assertStringContainsString('Жми', $preview['html']);
        $this->assertStringContainsString('href="#"', $preview['html'], 'a harmless unsubscribe link');
        $this->assertSame('Тема', $this->mailing($id)->subject, 'nothing was saved');
        $this->assertSame(['html', 'subject'], array_keys($preview));
    }

    public function testTheTestLetterOfAMissingMailing(): void
    {
        $this->signIn('admin1');

        $this->post('mailings/nothere/test')->assertStatus(404);
    }

    // ------------------------------------------------------------------ the picture

    public function testThePictureIsStoredReplacedAndRemoved(): void
    {
        $this->signIn('admin1');

        $id = $this->draft();
        $this->folders[] = $id;

        $first = json_decode($this->upload("mailings/{$id}/image", $this->png(), 'image/png')->getJSON(), true)['image'];

        $this->assertMatchesRegularExpression("#^uploads/mailings/{$id}/[0-9a-f]{16}\\.png\$#", $first);
        $this->assertFileExists(FCPATH . $first);

        $second = json_decode($this->upload("mailings/{$id}/image", $this->png(), 'image/png')->getJSON(), true)['image'];

        $this->assertNotSame($first, $second);
        $this->assertFileDoesNotExist(FCPATH . $first, 'the old picture is removed');
        $this->assertFileExists(FCPATH . $second);

        // Not a JPEG or PNG: by the content, not by the name
        $svg = $this->tempFile('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>', 'png');
        $bad = $this->upload("mailings/{$id}/image", $svg, 'image/png');

        $bad->assertStatus(400);
        $this->assertArrayHasKey('image', json_decode($bad->getJSON(), true)['messages']);

        $webp = $this->tempFile("RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00\x30\x01\x00\x9d\x01\x2a\x01\x00\x01\x00\x02\x00\x34\x25\xa4\x00\x03\x70\x00\xfe\xfb\xfd\x50\x00", 'jpg');
        $this->upload("mailings/{$id}/image", $webp, 'image/jpeg')->assertStatus(400);

        $big = $this->tempFile(base64_decode(self::PNG) . str_repeat('0', 2 * 1024 * 1024), 'png');
        $this->upload("mailings/{$id}/image", $big, 'image/png')->assertStatus(400);

        $this->assertSame($second, $this->mailing($id)->image);

        $this->delete("mailings/{$id}/image")->assertStatus(200);
        $this->assertNull($this->mailing($id)->image);
        $this->assertFileDoesNotExist(FCPATH . $second);

        // A draft that goes takes its folder along
        $this->upload("mailings/{$id}/image", $this->png(), 'image/png')->assertStatus(200);
        $path = $this->mailing($id)->image;
        $this->delete("mailings/{$id}")->assertStatus(200);
        $this->assertFileDoesNotExist(FCPATH . $path);
    }

    // ------------------------------------------------------------------ helpers

    /** user1, user2 and admin1 stay in the audience; the four below do not */
    private function audienceUsers(): void
    {
        $this->createUser('off', ['settings' => json_encode(['emailNews' => false])]);
        $this->createUser('bounced', ['email_bounced_at' => date('Y-m-d H:i:s')]);
        $this->createUser('service', ['email' => 'bot@geometki.com']);
        $this->createUser('invalid', ['email' => 'nobody@mail']);
    }

    /** @param array<string, mixed> $fields */
    private function draft(array $fields = []): string
    {
        static $number = 0;
        $id = 'mailing' . ++$number . substr(md5((string) microtime(true)), 0, 4);

        $this->db->table('mailings')->insert($fields + [
            'id' => $id, 'subject' => 'Тема', 'content' => 'Привет, **мир**', 'status' => 'draft', 'author_id' => 'admin1',
            'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $id;
    }

    private function mailing(string $id): object
    {
        return $this->db->table('mailings')->where('id', $id)->get()->getRow();
    }

    /** @return string[] */
    private function sentTo(): array
    {
        $to = array_map(static fn ($message) => $message->to, $this->mailer->sent);
        sort($to);

        return $to;
    }

    private function json(string $method, string $uri, array $body): TestResponse
    {
        return $this->withBodyFormat('json')->withBody(json_encode($body))->{$method}($uri);
    }

    private function png(): string
    {
        return $this->tempFile(base64_decode(self::PNG), 'png');
    }

    private function tempFile(string $content, string $extension): string
    {
        $path = tempnam(sys_get_temp_dir(), 'mal') ?: '';
        rename($path, $path .= '.' . $extension);
        file_put_contents($path, $content);

        return $path;
    }

    private function upload(string $uri, string $file, string $mime): TestResponse
    {
        service('superglobals')->setFilesArray(['image' => [
            'name' => basename($file), 'type' => $mime, 'tmp_name' => $file, 'error' => UPLOAD_ERR_OK, 'size' => filesize($file),
        ]]);

        return $this->post($uri);
    }
}
