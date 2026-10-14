<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * What a user can be notified about, through which channels, and how the
 * queues behave. The single source of truth for notification preferences:
 * `users.settings` keys are `{channel}{Type}` (`emailComment`, `emailDigest`,
 * `pushComment`, `pushAchievement`), built from $channelTypes by
 * App\Libraries\NotificationSettings.
 */
class Notifications extends BaseConfig
{
    /**
     * Delivery channels a user can switch per type. The in-app notification
     * under the bell is always on and is not a channel here.
     *
     * @var string[]
     */
    public array $channels = ['email', 'push'];

    /**
     * Notification types: activity on a user's place, the weekly digest
     * (email only), a new achievement and a new level (push only).
     *
     * @var string[]
     */
    public array $types = ['comment', 'photo', 'rating', 'edit', 'cover', 'bookmark', 'visit', 'digest', 'achievement', 'level'];

    /**
     * Activity types that notify the place owner (a subset of $types).
     *
     * @var string[]
     */
    public array $activityTypes = ['comment', 'photo', 'rating', 'edit', 'cover', 'bookmark', 'visit'];

    /**
     * The types each channel carries.
     *
     * @var array<string, string[]>
     */
    public array $channelTypes = [
        'email' => ['comment', 'photo', 'rating', 'edit', 'cover', 'bookmark', 'visit', 'digest'],
        'push'  => ['comment', 'photo', 'rating', 'edit', 'cover', 'bookmark', 'visit', 'achievement', 'level'],
    ];

    /**
     * Defaults per `{channel}{Type}` key. A key not listed here is on.
     *
     * @var array<string, bool>
     */
    public array $defaults = [];

    // -------------------------------------------------------------------------
    // Email queue (`sending_mail`, processed by `notifications:send`)
    // -------------------------------------------------------------------------

    /**
     * After an activity email, the next ones for the same user wait this long
     * and then go out together as one email.
     */
    public int $activityEmailIntervalHours = 5;

    /**
     * The hosting's limits, applied to weekly digests only (the bulk mail): at
     * most this many per hour and per day. Over a limit the digests wait in the
     * queue and go when the window frees up. Activity notifications and sign-in
     * links are not counted.
     */
    public int $digestHourLimit = 500;
    public int $digestDayLimit  = 2000;

    /** Emails a single `notifications:send` run claims at most. */
    public int $batchSize = 100;

    /** Attempts before an email is marked `error`; retries back off exponentially. */
    public int $maxAttempts        = 4;
    public int $retryBaseMinutes   = 5;

    /**
     * A claimed email whose worker died is released after this many minutes;
     * a run stops sending at half of it, so it never overlaps the release.
     */
    public int $staleLockMinutes = 15;

    /**
     * More "no such mailbox" rejections than this in one run with nothing sent
     * means the sender setup is broken: no address is marked as bounced.
     */
    public int $maxBouncesPerRun = 3;

    /** A queued email not sent within this many days is marked `expired`. */
    public int $expireAfterDays = 3;

    /**
     * A digest may wait for the hosting limits longer, up to the next week's
     * digest: thousands of them take days at 2000 a day.
     */
    public int $digestExpireAfterDays = 6;

    /** `notifications:send` deletes queue rows older than this, once a day. */
    public int $retentionDays = 90;

    /** `digest:weekly` skips users who got a digest less than this many days ago. */
    public int $digestMinIntervalDays = 6;

    // -------------------------------------------------------------------------
    // Push queue (`push_messages`, processed by `notifications:send`)
    // -------------------------------------------------------------------------

    /**
     * A push waits this long first: on an open site the toast shows the
     * notification and marks it read, and the push is dropped.
     */
    public int $pushDelaySeconds = 60;

    /** After a push about places, the next ones within this many minutes go out as one. */
    public int $pushGroupMinutes = 15;

    /**
     * Quiet hours in the time zone of the user's device: pushes about places
     * wait for the end (achievements and levels follow the user's own action).
     */
    public int $quietHoursStart = 23;
    public int $quietHoursEnd   = 8;

    /** A push not sent within this many hours is no news any more: `expired`. */
    public int $pushExpireAfterHours = 24;

    /** Pushes a single run claims at most. */
    public int $pushBatchSize = 200;

    /** How long the push service keeps an undelivered push (seconds). */
    public int $pushTtl = 86400;

    /** A subscription failing this many times in a row is deleted by the daily cleanup. */
    public int $subscriptionMaxFailures = 10;
}
