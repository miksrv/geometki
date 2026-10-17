<?php

use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * POST /push/subscriptions/renew and DELETE /push/subscriptions (App\Controllers\Push):
 * a device keeps its owner when the browser renews it, even after the push service
 * dropped it and its row was deleted.
 *
 * @internal
 */
final class PushApiTest extends MySqlTestCase
{
    use FeatureTestTrait;

    private const OLD = 'https://fcm.googleapis.com/fcm/send/old-device';
    private const NEW = 'https://fcm.googleapis.com/fcm/send/new-device';

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('user1');
    }

    private function renew(): \CodeIgniter\Test\TestResponse
    {
        return $this->withBodyFormat('json')->post('push/subscriptions/renew', [
            'oldEndpoint'  => self::OLD,
            'subscription' => [
                'endpoint' => self::NEW,
                'keys'     => ['p256dh' => 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', 'auth' => 'tBHItJI5svbpez7KI4CCXg'],
            ],
        ]);
    }

    private function devices(): array
    {
        return $this->db->table('push_subscriptions')->get()->getResult();
    }

    public function testRenewMovesAnExistingDevice(): void
    {
        $this->createSubscription('sub1', 'user1', self::OLD);

        $this->renew()->assertOK();

        $devices = $this->devices();
        $this->assertCount(1, $devices);
        $this->assertSame(self::NEW, $devices[0]->endpoint);
        $this->assertSame('user1', $devices[0]->user_id);
        $this->assertSame('Europe/Moscow', $devices[0]->timezone);
    }

    public function testRenewFindsTheOwnerOfAnExpiredDevice(): void
    {
        $device = $this->createSubscription('sub1', 'user1', self::OLD);
        (new \App\Models\PushSubscriptionsModel())->expire($device);

        $this->assertSame([], $this->devices());

        $this->renew()->assertOK();

        $devices = $this->devices();
        $this->assertCount(1, $devices);
        $this->assertSame(self::NEW, $devices[0]->endpoint);
        $this->assertSame('user1', $devices[0]->user_id);
        $this->assertSame('Europe/Moscow', $devices[0]->timezone);
        $this->assertSame(0, $this->db->table('push_subscriptions_expired')->countAllResults());
    }

    public function testAnExpiredDeviceIsNotRenewedAfterItsTime(): void
    {
        $this->db->table('push_subscriptions_expired')->insert([
            'endpoint_hash' => hash('sha256', self::OLD),
            'user_id'       => 'user1',
            'created_at'    => date('Y-m-d H:i:s', strtotime('-31 days')),
        ]);

        $this->renew()->assertStatus(404);
        $this->assertSame([], $this->devices());
    }

    public function testRenewOfAnUnknownDeviceIsNotFound(): void
    {
        $this->renew()->assertStatus(404);
        $this->assertSame([], $this->devices());
    }

    public function testUnsubscribeAlsoForgetsTheExpiredDevice(): void
    {
        $device = $this->createSubscription('sub1', 'user1', self::OLD);
        (new \App\Models\PushSubscriptionsModel())->expire($device);

        $this->withBodyFormat('json')->delete('push/subscriptions', ['endpoint' => self::OLD])->assertOK();

        $this->renew()->assertStatus(404);
        $this->assertSame([], $this->devices());
    }

    public function testStatusTakesTheEndpointInThePostBody(): void
    {
        $this->createSubscription('sub1', 'user1', self::OLD);
        $this->signIn('user1');

        $response = $this->withBodyFormat('json')->post('push/subscriptions/status', ['endpoint' => self::OLD]);
        $response->assertOK();
        $response->assertJSONExact(['active' => true, 'devices' => 1]);

        $this->withBodyFormat('json')->post('push/subscriptions/status', ['endpoint' => self::NEW])
            ->assertJSONExact(['active' => false, 'devices' => 1]);
    }

    public function testStatusOfAnotherAccountsDeviceIsOff(): void
    {
        $this->createUser('user2');
        $this->createSubscription('sub1', 'user2', self::OLD);
        $this->signIn('user1');

        $this->withBodyFormat('json')->post('push/subscriptions/status', ['endpoint' => self::OLD])
            ->assertJSONExact(['active' => false, 'devices' => 0]);
    }

    public function testStatusNeedsSigningIn(): void
    {
        $this->withBodyFormat('json')->post('push/subscriptions/status', ['endpoint' => self::OLD])->assertStatus(401);
    }
}
