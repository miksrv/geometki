<?php

namespace App\Libraries;

/**
 * Computes whether a collection should be index,follow (true) or
 * noindex,follow (false). The result is never
 * shown in the UI; it only drives the robots meta tag, the sitemap, and
 * `/collections` index filters for crawlers.
 *
 * Pure, DB-free logic so it can be unit tested directly.
 */
class CollectionIndexability
{
    /**
     * @param string|null $description Raw markdown description.
     * @param int $placesCount Non-deleted places currently in the collection.
     * @param bool $hidden Admin "hidden" switch.
     * @return bool
     */
    public static function isIndexable(?string $description, int $placesCount, bool $hidden): bool
    {
        if ($hidden) {
            return false;
        }

        if ($placesCount < COLLECTION_INDEX_MIN_PLACES) {
            return false;
        }

        $plainLength = mb_strlen(self::stripMarkdown((string) $description), 'UTF-8');

        return $plainLength >= COLLECTION_INDEX_MIN_DESCRIPTION;
    }

    /**
     * Strip common markdown syntax and HTML down to plain text, for length
     * checks and meta-description fallbacks. Not a renderer — only used to
     * approximate the amount of real prose in a description.
     *
     * @param string $markdown
     * @return string
     */
    public static function stripMarkdown(string $markdown): string
    {
        $text = $markdown;

        // Fenced and inline code
        $text = preg_replace('/```.*?```/s', ' ', $text) ?? $text;
        $text = preg_replace('/`([^`]*)`/', '$1', $text) ?? $text;

        // Images and links: keep the visible text, drop the target
        $text = preg_replace('/!\[([^\]]*)\]\([^)]*\)/', '$1', $text) ?? $text;
        $text = preg_replace('/\[([^\]]*)\]\([^)]*\)/', '$1', $text) ?? $text;

        // Headings
        $text = preg_replace('/^#{1,6}\s*/m', '', $text) ?? $text;

        // Emphasis / strikethrough
        $text = preg_replace('/(\*\*|__)(.*?)\1/s', '$2', $text) ?? $text;
        $text = preg_replace('/(\*|_)(.*?)\1/s', '$2', $text) ?? $text;
        $text = preg_replace('/~~(.*?)~~/s', '$1', $text) ?? $text;

        // Blockquotes and list markers
        $text = preg_replace('/^>\s?/m', '', $text) ?? $text;
        $text = preg_replace('/^\s*([-*+]|\d+\.)\s+/m', '', $text) ?? $text;

        // Any leftover HTML
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        // Collapse whitespace
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
    }
}
