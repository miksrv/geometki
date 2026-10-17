<?php

namespace Tests\Support;

use App\Libraries\Push\PushSender;

/**
 * A push service that answers what the test tells it to: every device gets
 * `$outcome` (ok by default), and every call is recorded.
 */
class FakePushSender extends PushSender
{
    /** @var array{ok: bool, expired: bool, reason: string} */
    public array $outcome = ['ok' => true, 'expired' => false, 'reason' => ''];

    /** @var array<int, array{devices: string[], payload: array}> */
    public array $sent = [];

    public function __construct()
    {
    }

    public function send(array $subscriptions, array $payload, array $options = []): array
    {
        $this->sent[] = ['devices' => array_map(static fn ($row) => $row->id, $subscriptions), 'payload' => $payload];

        return array_fill_keys(array_map(static fn ($row) => $row->id, $subscriptions), $this->outcome);
    }
}
