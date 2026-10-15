<?php

use App\Libraries\NotificationSettings;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Notifications;

/**
 * @internal
 */
final class NotificationSettingsTest extends CIUnitTestCase
{
    private NotificationSettings $settings;

    protected function setUp(): void
    {
        parent::setUp();
        $this->settings = new NotificationSettings(new Notifications());
    }

    public function testKeysAreChannelTimesType(): void
    {
        $this->assertSame('emailComment', NotificationSettings::key('email', 'comment'));
        $this->assertContains('emailDigest', $this->settings->keys());
        $this->assertContains('emailVisit', $this->settings->keys());
        $this->assertCount(array_sum(array_map('count', (new Notifications())->channelTypes)), $this->settings->keys());
        $this->assertContains('pushAchievement', $this->settings->keys());
        $this->assertNotContains('emailAchievement', $this->settings->keys(), 'achievements are push only');
        $this->assertNotContains('pushDigest', $this->settings->keys(), 'the digest is email only');
    }

    public function testNullSettingsMeanEverythingOn(): void
    {
        $normalized = $this->settings->normalize(null);

        foreach ($this->settings->keys() as $key) {
            $this->assertTrue($normalized->$key, $key);
        }
    }

    public function testNormalizeKeepsStoredValuesAndDropsUnknownKeys(): void
    {
        $normalized = $this->settings->normalize('{"emailComment":false,"emailPlace":false,"junk":1}');

        $this->assertFalse($normalized->emailComment);
        $this->assertTrue($normalized->emailEdit);
        $this->assertObjectNotHasProperty('emailPlace', $normalized);
        $this->assertObjectNotHasProperty('junk', $normalized);
    }

    public function testNormalizeIgnoresNonBooleanValues(): void
    {
        $this->assertTrue($this->settings->normalize(['emailComment' => 'no'])->emailComment);
    }

    public function testMergeAppliesOnlyBooleans(): void
    {
        $merged = $this->settings->merge(
            (object) ['emailComment' => false, 'emailDigest' => false],
            (object) ['emailComment' => true, 'emailDigest' => 'yes', 'emailVisit' => false]
        );

        $this->assertTrue($merged->emailComment);
        $this->assertFalse($merged->emailDigest, 'a non-boolean input keeps the stored value');
        $this->assertFalse($merged->emailVisit);
        $this->assertTrue($merged->emailPhoto, 'an omitted key keeps its value');
    }

    public function testIsEnabledPerType(): void
    {
        $stored = ['emailBookmark' => false];

        $this->assertFalse($this->settings->isEnabled($stored, 'email', 'bookmark'));
        $this->assertTrue($this->settings->isEnabled($stored, 'email', 'visit'));
    }

    public function testTypesWithoutEmailAreNeverEnabled(): void
    {
        // `place`, `collection` … are activity types that notify nobody by email
        $this->assertFalse($this->settings->isEnabled(null, 'email', 'place'));
        $this->assertFalse($this->settings->isEnabled(null, 'email', 'collection'));
    }

    public function testDisableOneType(): void
    {
        $result = $this->settings->disable(null, 'email', 'comment');

        $this->assertFalse($result->emailComment);
        $this->assertTrue($result->emailPhoto);
        $this->assertTrue($result->emailDigest);
    }

    public function testDisableActivityScopeKeepsDigest(): void
    {
        $result = $this->settings->disable(null, 'email', 'activity');

        foreach ((new Notifications())->activityTypes as $type) {
            $this->assertFalse($result->{NotificationSettings::key('email', $type)}, $type);
        }
        $this->assertTrue($result->emailDigest);
    }

    public function testDisableAllOfAChannel(): void
    {
        $result = $this->settings->disable(['emailComment' => true], 'email', 'all');

        foreach ($this->settings->keys() as $key) {
            if (str_starts_with($key, 'email')) {
                $this->assertFalse($result->$key, $key);
            } else {
                $this->assertTrue($result->$key, "{$key}: another channel is not touched");
            }
        }
    }

    public function testTypesOutsideTheChannelAreNeverEnabled(): void
    {
        $this->assertFalse($this->settings->isEnabled(null, 'email', 'achievement'));
        $this->assertFalse($this->settings->isEnabled(null, 'push', 'digest'));
        $this->assertTrue($this->settings->isEnabled(null, 'push', 'level'));
        $this->assertFalse($this->settings->isEnabled(null, 'sms', 'comment'), 'unknown channel');
    }

    public function testDisableUnknownScopeChangesNothing(): void
    {
        $this->assertEquals($this->settings->normalize(null), $this->settings->disable(null, 'email', 'everything'));
        $this->assertSame([], $this->settings->typesOfScope('everything'));
    }

    public function testScopeEnabledWhileAnyTypeIsOn(): void
    {
        $this->assertTrue($this->settings->isScopeEnabled(['emailComment' => false], 'email', 'activity'));

        $allActivityOff = (array) $this->settings->disable(null, 'email', 'activity');
        $this->assertFalse($this->settings->isScopeEnabled($allActivityOff, 'email', 'activity'));
        $this->assertTrue($this->settings->isScopeEnabled($allActivityOff, 'email', 'all'));
    }

    public function testServiceEmailsAreTheConfiguredDomains(): void
    {
        $this->assertTrue($this->settings->isServiceEmail('user2@geometki.com'));
        $this->assertTrue($this->settings->isServiceEmail('Bot@GEOMETKI.com'));
        $this->assertFalse($this->settings->isServiceEmail('user@gmail.com'));
        $this->assertFalse($this->settings->isServiceEmail('user@mail.geometki.com'), 'a subdomain is not the domain');
        $this->assertFalse($this->settings->isServiceEmail('user@geometki.com.evil.org'));
        $this->assertFalse($this->settings->isServiceEmail(''));
        $this->assertFalse($this->settings->isServiceEmail(null));
    }
}
