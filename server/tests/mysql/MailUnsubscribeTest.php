<?php

use App\Libraries\Mail\UnsubscribeToken;
use CodeIgniter\Test\FeatureTestTrait;
use Tests\Support\MySqlTestCase;

/**
 * GET /mail/unsubscribe only reads, POST turns the emails off (App\Controllers\Mail).
 *
 * @internal
 */
final class MailUnsubscribeTest extends MySqlTestCase
{
    use FeatureTestTrait;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createUser('user1');
    }

    private function settings(): array
    {
        return json_decode((string) $this->db->table('users')->where('id', 'user1')->get()->getRow()->settings, true) ?? [];
    }

    private function token(string $type): string
    {
        return (new UnsubscribeToken())->create('user1', $type);
    }

    public function testReadingTheLinkChangesNothing(): void
    {
        $response = $this->get('mail/unsubscribe', ['token' => $this->token('digest')]);

        $response->assertOK();
        $response->assertJSONFragment(['scope' => 'digest', 'subscribed' => true]);
        $this->assertSame([], $this->settings());
    }

    public function testPostTurnsOffTheTokensEmails(): void
    {
        $response = $this->withBodyFormat('json')->post('mail/unsubscribe', ['token' => $this->token('digest')]);

        $response->assertOK();
        $response->assertJSONExact(['scope' => 'digest', 'subscribed' => false]);
        $this->assertFalse($this->settings()['emailDigest']);
        $this->assertTrue($this->settings()['emailComment'] ?? true);

        $this->get('mail/unsubscribe', ['token' => $this->token('digest')])->assertJSONFragment(['subscribed' => false]);
    }

    public function testPostCanTurnOffEveryEmail(): void
    {
        $this->withBodyFormat('json')->post('mail/unsubscribe', ['token' => $this->token('digest'), 'scope' => 'all'])->assertOK();

        $emails = array_filter($this->settings(), static fn ($key) => str_starts_with($key, 'email'), ARRAY_FILTER_USE_KEY);

        $this->assertNotEmpty($emails);
        $this->assertSame([], array_filter($emails));
    }

    public function testABrokenOrForgedTokenIsRefused(): void
    {
        $this->get('mail/unsubscribe', ['token' => 'broken'])->assertStatus(400);

        $forged = (new UnsubscribeToken('another-secret-another-secret-another'))->create('user1', 'digest');
        $this->withBodyFormat('json')->post('mail/unsubscribe', ['token' => $forged])->assertStatus(400);

        $this->assertSame([], $this->settings());
    }
}
