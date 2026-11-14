<?php

namespace App\Libraries;

use Config\Users;

/**
 * The user's display name: one rule for every way a name gets in
 * (registration, a sign-in service, a magic link, the settings).
 *
 * A name is normalized first (no control or invisible characters, single
 * spaces, trimmed), then it must be at most Users::NAME_MAX characters long,
 * hold at least Users::NAME_MIN letters or digits and only letters, digits,
 * spaces and . - _ ' ’ ( ) — no links or email addresses.
 *
 * A typed name that breaks the rule is refused (rule valid_user_name);
 * a name that comes from a service is fixed instead (forNewUser()),
 * so signing in never fails because of the name.
 */
final class UserName
{
    /** Characters a name may hold besides letters, marks and digits. */
    private const EXTRA_CHARS = " .\\-_'’()";

    /**
     * Removes control and invisible characters, collapses whitespace into single spaces, trims.
     */
    public static function normalize(?string $name): string
    {
        if ($name === null || $name === '') {
            return '';
        }

        if (class_exists(\Normalizer::class)) {
            $name = \Normalizer::normalize($name, \Normalizer::FORM_C) ?: $name;
        }

        $name = preg_replace('/\s+/u', ' ', $name) ?? '';
        // Control, format (zero-width, direction marks), private use and unassigned characters
        $name = preg_replace('/\p{C}+/u', '', $name) ?? '';

        return trim(preg_replace('/ {2,}/', ' ', $name) ?? '');
    }

    /**
     * Why a normalized name breaks the rule: the Users language key, or null for a valid name.
     */
    public static function error(string $name): ?string
    {
        if (mb_strlen($name) > Users::NAME_MAX) {
            return 'nameTooLong';
        }

        if (preg_match('/[^\p{L}\p{M}\p{N}' . self::EXTRA_CHARS . ']/u', $name)) {
            return 'nameInvalidChars';
        }

        if (self::countLetters($name) < Users::NAME_MIN) {
            return 'nameTooShort';
        }

        return null;
    }

    public static function isValid(string $name): bool
    {
        return self::error($name) === null;
    }

    /**
     * A valid name for a new account from what a service gave (or nothing, for a magic link):
     * characters out of the rule are dropped, a long name is cut at a word, and a name with
     * too few letters gets the word "Explorer" in the user's language ("Я" → "Я Исследователь").
     */
    public static function forNewUser(?string $name, ?string $locale = null): string
    {
        $locale = substr((string) $locale, 0, 2);
        $word   = lang(
            'Users.defaultName',
            [],
            in_array($locale, config('App')->supportedLocales, true) ? $locale : null
        );
        $name = self::normalize(
            preg_replace('/[^\p{L}\p{M}\p{N}' . self::EXTRA_CHARS . ']/u', ' ', self::normalize($name)) ?? ''
        );

        if (mb_strlen($name) > Users::NAME_MAX) {
            $name = self::cut($name);
        }

        if (self::countLetters($name) === 0) {
            return $word;
        }

        if (self::countLetters($name) < Users::NAME_MIN) {
            $name = self::cut($name . ' ' . $word);
        }

        return self::isValid($name) ? $name : $word;
    }

    private static function countLetters(string $name): int
    {
        return preg_match_all('/[\p{L}\p{N}]/u', $name);
    }

    /** Cuts a name to Users::NAME_MAX characters, at the last space when there is one. */
    private static function cut(string $name): string
    {
        if (mb_strlen($name) <= Users::NAME_MAX) {
            return $name;
        }

        $cut   = mb_substr($name, 0, Users::NAME_MAX + 1);
        $space = mb_strrpos($cut, ' ');
        $cut   = $space !== false && $space > 0 ? mb_substr($cut, 0, $space) : mb_substr($name, 0, Users::NAME_MAX);

        return rtrim($cut, ' .-_');
    }
}
