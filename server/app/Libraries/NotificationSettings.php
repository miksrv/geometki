<?php

namespace App\Libraries;

use Config\Notifications;

/**
 * A user's notification preferences (`users.settings`), built from
 * Config\Notifications: one boolean per `{channel}{Type}` key of the types
 * the channel carries, e.g. `emailComment`, `emailDigest`, `pushAchievement`.
 * A missing key means the default (on).
 */
class NotificationSettings
{
    private Notifications $config;

    public function __construct(?Notifications $config = null)
    {
        $this->config = $config ?? config('Notifications');
    }

    /**
     * The settings key of a channel and type: ('email', 'comment') → 'emailComment'.
     */
    public static function key(string $channel, string $type): string
    {
        return $channel . ucfirst($type);
    }

    /**
     * All known keys, in the order of channels, then types.
     *
     * @return string[]
     */
    public function keys(): array
    {
        $keys = [];

        foreach ($this->config->channels as $channel) {
            foreach ($this->channelTypes($channel) as $type) {
                $keys[] = self::key($channel, $type);
            }
        }

        return $keys;
    }

    /**
     * The full settings object with defaults filled in. Unknown keys are dropped.
     *
     * @param object|array|string|null $stored `users.settings` as stored (JSON, object or null)
     */
    public function normalize(object|array|string|null $stored): object
    {
        $stored = $this->toArray($stored);
        $result = [];

        foreach ($this->keys() as $key) {
            $result[$key] = is_bool($stored[$key] ?? null) ? $stored[$key] : ($this->config->defaults[$key] ?? true);
        }

        return (object) $result;
    }

    /**
     * Stored settings with the boolean values of $input applied on top;
     * non-boolean and unknown input values are ignored.
     */
    public function merge(object|array|string|null $stored, object|array|null $input): object
    {
        $result = $this->normalize($stored);
        $input  = $this->toArray($input);

        foreach ($this->keys() as $key) {
            if (isset($input[$key]) && is_bool($input[$key])) {
                $result->$key = $input[$key];
            }
        }

        return $result;
    }

    public function isEnabled(object|array|string|null $stored, string $channel, string $type): bool
    {
        if (!in_array($type, $this->channelTypes($channel), true)) {
            return false;
        }

        return (bool) $this->normalize($stored)->{self::key($channel, $type)};
    }

    /**
     * Settings with one type of a channel turned off, or a whole scope:
     * `activity` (every activity type), `all` (every type).
     */
    public function disable(object|array|string|null $stored, string $channel, string $type): object
    {
        $result = $this->normalize($stored);
        $types  = array_intersect($this->typesOfScope($type), $this->channelTypes($channel));

        foreach ($types as $item) {
            $result->{self::key($channel, $item)} = false;
        }

        return $result;
    }

    /**
     * The types a scope covers: a single type, `activity` or `all`; [] for an unknown scope.
     *
     * @return string[]
     */
    public function typesOfScope(string $scope): array
    {
        return match (true) {
            $scope === 'all'            => $this->config->types,
            $scope === 'activity'       => $this->config->activityTypes,
            $this->isKnownType($scope)  => [$scope],
            default                     => [],
        };
    }

    /**
     * Whether any type of the scope is still on for the channel.
     */
    public function isScopeEnabled(object|array|string|null $stored, string $channel, string $scope): bool
    {
        $settings = $this->normalize($stored);

        foreach (array_intersect($this->typesOfScope($scope), $this->channelTypes($channel)) as $type) {
            if ($settings->{self::key($channel, $type)}) {
                return true;
            }
        }

        return false;
    }

    /**
     * The types a channel carries ([] for an unknown channel).
     *
     * @return string[]
     */
    public function channelTypes(string $channel): array
    {
        return $this->config->channelTypes[$channel] ?? [];
    }

    /**
     * Whether the address belongs to a service account (Notifications::$serviceEmailDomains),
     * which is never notified.
     */
    public function isServiceEmail(?string $email): bool
    {
        $at = strrpos((string) $email, '@');

        if ($at === false) {
            return false;
        }

        $domain = strtolower(trim(substr($email, $at + 1)));

        return in_array($domain, array_map('strtolower', $this->config->serviceEmailDomains), true);
    }

    public function isKnownType(string $type): bool
    {
        return in_array($type, $this->config->types, true);
    }

    public function isActivityType(string $type): bool
    {
        return in_array($type, $this->config->activityTypes, true);
    }

    private function toArray(object|array|string|null $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        if (is_object($value)) {
            $value = get_object_vars($value);
        }

        return is_array($value) ? $value : [];
    }
}
