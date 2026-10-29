<?php

use App\Libraries\Mail\MailerException;
use App\Libraries\Mail\MailQueue;
use Tests\Support\FakeMailer;
use Tests\Support\MySqlTestCase;

/**
 * An email run of `notifications:send` (App\Libraries\Mail\MailQueue::process())
 * against a fake SMTP transport.
 *
 * @internal
 */
final class MailQueueTest extends MySqlTestCase
{
    private FakeMailer $mailer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mailer = new FakeMailer();

        $this->createUser('user1', ['email' => 'traveller@example.com', 'locale' => 'ru']);
    }

    private function queueDigest(string $id): void
    {
        $this->db->table('sending_mail')->insert([
            'id'      => $id,
            'user_id' => 'user1',
            'type'    => 'digest',
            'status'  => 'created',
            'email'   => 'traveller@example.com',
            'locale'  => 'ru',
            'subject' => 'Что нового за неделю',
            'message' => '<p>Новые места рядом с вами</p>',
        ]);
    }

    private function queueActivity(string $id, string $activityId): void
    {
        $this->db->table('activity')->insert(['id' => $activityId, 'type' => 'comment']);

        $this->db->table('sending_mail')->insert([
            'id'          => $id,
            'user_id'     => 'user1',
            'activity_id' => $activityId,
            'type'        => 'comment',
            'status'      => 'created',
            'email'       => 'traveller@example.com',
            'locale'      => 'ru',
        ]);
    }

    private function mail(string $id): object
    {
        return $this->db->table('sending_mail')->where('id', $id)->get()->getRow();
    }

    public function testADigestIsSent(): void
    {
        $this->queueDigest('mail1');

        $stats = (new MailQueue($this->mailer))->process();

        $this->assertSame(1, $stats['sent']);
        $this->assertCount(1, $this->mailer->sent);
        $this->assertSame('traveller@example.com', $this->mailer->sent[0]->to);
        $this->assertStringContainsString('Новые места рядом с вами', $this->mailer->sent[0]->html);
        $this->assertNotNull($this->mailer->sent[0]->unsubscribeUrl);
        $this->assertSame('completed', $this->mail('mail1')->status);
    }

    public function testATurnedOffEmailIsNotSent(): void
    {
        $this->db->table('users')->where('id', 'user1')->update(['settings' => json_encode(['emailDigest' => false])]);
        $this->queueDigest('mail1');

        (new MailQueue($this->mailer))->process();

        $this->assertSame([], $this->mailer->sent);
        $this->assertSame('rejected', $this->mail('mail1')->status);
    }

    public function testAnInvalidAddressIsNotSent(): void
    {
        $this->db->table('users')->where('id', 'user1')->update(['email' => 'traveller@mail']);
        $this->queueDigest('mail1');

        (new MailQueue($this->mailer))->process();

        $this->assertSame([], $this->mailer->sent);
        $this->assertSame('rejected', $this->mail('mail1')->status);
    }

    public function testAnEventAPushDeliveredIsNotEmailed(): void
    {
        $this->db->table('push_messages')->insert([
            'id' => 'push1', 'user_id' => 'user1', 'type' => 'comment', 'activity_id' => 'act1', 'status' => 'completed',
        ]);
        $this->queueActivity('mail1', 'act1');

        (new MailQueue($this->mailer))->process();

        $this->assertSame([], $this->mailer->sent);
        $this->assertSame('rejected', $this->mail('mail1')->status);
        $this->assertSame('Delivered as push or seen on the site', $this->mail('mail1')->error);
    }

    public function testAnEmailWaitsWhileItsPushDoes(): void
    {
        $this->db->table('push_messages')->insert([
            'id' => 'push1', 'user_id' => 'user1', 'type' => 'comment', 'activity_id' => 'act1', 'status' => 'created',
        ]);
        $this->queueActivity('mail1', 'act1');

        (new MailQueue($this->mailer))->process();

        $this->assertSame('created', $this->mail('mail1')->status);
        $this->assertGreaterThan(date('Y-m-d H:i:s'), $this->mail('mail1')->next_attempt_at);
    }

    public function testATemporaryFailureIsRetriedLater(): void
    {
        $this->mailer->failure = new MailerException('421 Try again later');
        $this->queueDigest('mail1');

        (new MailQueue($this->mailer))->process();

        $row = $this->mail('mail1');
        $this->assertSame('created', $row->status);
        $this->assertSame('1', (string) $row->attempts);
        $this->assertGreaterThan(date('Y-m-d H:i:s'), $row->next_attempt_at);
    }

    public function testARejectedAddressIsMarkedAndGetsNoMore(): void
    {
        $this->mailer->failure = new MailerException('550 5.1.1 No such user', true);
        $this->queueDigest('mail1');

        (new MailQueue($this->mailer))->process();

        $this->assertSame('error', $this->mail('mail1')->status);
        $this->assertNotNull($this->db->table('users')->where('id', 'user1')->get()->getRow()->email_bounced_at);

        $this->mailer->failure = null;
        $this->queueDigest('mail2');

        (new MailQueue($this->mailer))->process();

        $this->assertSame([], $this->mailer->sent);
        $this->assertSame('rejected', $this->mail('mail2')->status);
    }
}
