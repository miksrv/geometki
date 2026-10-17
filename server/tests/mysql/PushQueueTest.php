<?php

use App\Libraries\Push\PushQueue;
use App\Models\PushMessagesModel;
use Config\Database;
use Config\Push as PushConfig;
use Tests\Support\FakePushSender;
use Tests\Support\MySqlTestCase;

/**
 * A `notifications:send` push run (App\Libraries\Push\PushQueue::process()) against a
 * fake push service, and the queue mechanics it shares with the email queue (QueueRows).
 *
 * @internal
 */
final class PushQueueTest extends MySqlTestCase
{
    private FakePushSender $sender;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sender = new FakePushSender();

        $this->createUser('user1');
        $this->createSubscription('sub1', 'user1', 'https://fcm.googleapis.com/fcm/send/device-1');
    }

    private function queue(): PushQueue
    {
        $config                  = new PushConfig();
        $config->vapidPublicKey  = 'public';
        $config->vapidPrivateKey = 'private';

        return new PushQueue($this->sender, null, $config);
    }

    /**
     * A push ready to go: queued a while ago, its delay over.
     */
    private function queuePush(string $id, array $fields = []): void
    {
        $this->db->table('push_messages')->insert($fields + [
            'id'              => $id,
            'user_id'         => 'user1',
            'type'            => 'achievement',
            'meta'            => json_encode(['title_ru' => 'Первооткрыватель', 'title_en' => 'Pioneer']),
            'status'          => 'created',
            'next_attempt_at' => date('Y-m-d H:i:s', time() - 60),
        ]);
    }

    private function push(string $id): object
    {
        return $this->db->table('push_messages')->where('id', $id)->get()->getRow();
    }

    public function testAnAchievementGoesOutAtOnce(): void
    {
        $this->queuePush('push1');

        $stats = $this->queue()->process();

        $this->assertSame(1, $stats['sent']);
        $this->assertCount(1, $this->sender->sent);
        $this->assertSame(['sub1'], $this->sender->sent[0]['devices']);
        $this->assertSame('completed', $this->push('push1')->status);
        $this->assertNull($this->push('push1')->locked_by);
    }

    public function testAPushSeenOnTheSiteIsDropped(): void
    {
        $this->db->table('users_notifications')->insert(['id' => 'note1', 'type' => 'achievements', 'read' => 1, 'user_id' => 'user1']);
        $this->queuePush('push1', ['notification_id' => 'note1']);

        $this->queue()->process();

        $this->assertSame([], $this->sender->sent);
        $this->assertSame('rejected', $this->push('push1')->status);
        $this->assertSame(PushQueue::SEEN_ON_SITE, $this->push('push1')->error);
    }

    public function testADeviceThePushServiceDroppedIsDeletedButRemembered(): void
    {
        $this->sender->outcome = ['ok' => false, 'expired' => true, 'reason' => '410 Gone'];
        $this->queuePush('push1');

        $this->queue()->process();

        $this->assertSame(0, $this->db->table('push_subscriptions')->countAllResults());
        $this->assertSame('user1', $this->db->table('push_subscriptions_expired')->get()->getRow()->user_id);
        $this->assertSame('rejected', $this->push('push1')->status);
    }

    public function testAFailedPushIsRetriedLater(): void
    {
        $this->sender->outcome = ['ok' => false, 'expired' => false, 'reason' => '500 Server error'];
        $this->queuePush('push1');

        $this->queue()->process();

        $row = $this->push('push1');
        $this->assertSame('created', $row->status);
        $this->assertSame('1', (string) $row->attempts);
        $this->assertGreaterThan(date('Y-m-d H:i:s'), $row->next_attempt_at);
        $this->assertSame('1', (string) $this->db->table('push_subscriptions')->get()->getRow()->failures);
    }

    public function testOnlyOneRunSendsAtATime(): void
    {
        $this->queuePush('push1');

        // Another run, on its own connection, is sending
        $other = Database::connect('tests', false);
        $other->query('SELECT GET_LOCK(?, 0)', ['push_queue_' . md5($this->db->getDatabase())]);

        try {
            $stats = $this->queue()->process();
        } finally {
            $other->query('SELECT RELEASE_LOCK(?)', ['push_queue_' . md5($this->db->getDatabase())]);
            $other->close();
        }

        $this->assertSame(0, $stats['sent']);
        $this->assertSame('created', $this->push('push1')->status);

        // Once it is done, the next run sends
        $this->assertSame(1, $this->queue()->process()['sent']);
    }

    public function testOverlappingClaimsNeverTakeTheSameRow(): void
    {
        $this->queuePush('push1');
        $this->queuePush('push2');

        $model = new PushMessagesModel();

        $first  = $model->claim('run-a', 1);
        $second = $model->claim('run-b', 5);

        $this->assertCount(1, $first);
        $this->assertCount(1, $second);
        $this->assertNotSame($first[0]->id, $second[0]->id);
    }

    public function testARunCannotOverwriteRowsTakenOverByAnother(): void
    {
        $this->queuePush('push1');

        $model = new PushMessagesModel();
        $model->claim('run-a', 1);

        // run-a died; its row went back to the queue and run-b took it
        $this->db->table('push_messages')->where('id', 'push1')->update(['locked_at' => date('Y-m-d H:i:s', strtotime('-1 hour'))]);
        $this->assertSame(1, $model->releaseStale(15, 4));
        $model->claim('run-b', 1);

        $this->assertFalse($model->markSent('push1', 'run-a'));
        $this->assertSame('process', $this->push('push1')->status);
        $this->assertTrue($model->markSent('push1', 'run-b'));
        $this->assertSame('completed', $this->push('push1')->status);
    }

    public function testAStaleRowRunsOutOfAttempts(): void
    {
        $this->queuePush('push1', ['attempts' => 3, 'status' => 'process', 'locked_by' => 'dead', 'locked_at' => date('Y-m-d H:i:s', strtotime('-1 hour'))]);

        (new PushMessagesModel())->releaseStale(15, 4);

        $this->assertSame('error', $this->push('push1')->status);
    }

    public function testOutcomesOfThePushesForTheEmail(): void
    {
        foreach (['act1' => 'completed', 'act2' => 'created', 'act3' => 'error'] as $activity => $status) {
            $this->queuePush('push-' . $activity, ['type' => 'comment', 'activity_id' => $activity, 'status' => $status]);
        }

        $this->queuePush('push-act4', ['type' => 'comment', 'activity_id' => 'act4', 'status' => 'rejected', 'error' => PushQueue::SEEN_ON_SITE]);

        $this->assertSame(
            ['act1' => 'delivered', 'act2' => 'pending', 'act3' => 'failed', 'act4' => 'delivered'],
            (new PushMessagesModel())->outcomesByActivity('user1', ['act1', 'act2', 'act3', 'act4', 'act5'])
        );
    }
}
