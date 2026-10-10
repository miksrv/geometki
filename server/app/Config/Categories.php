<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The place category keys the API accepts and reports. This is the whole
 * server-side knowledge of categories: names, descriptions, icons and
 * landing-page titles live in the client (client/utils/categories.ts and
 * its i18n files), so adding or renaming a category's wording never touches
 * the server. Adding a category means adding its key here and in the client
 * catalogue; `places.category` is validated against this list.
 */
class Categories extends BaseConfig
{
    /**
     * The niche taxonomy of features/09-place-categories.md: 23 keys, one
     * category per place.
     *
     * @var string[]
     */
    public array $names = [
        // Nature
        'mountain',
        'cave',
        'waterfall',
        'spring',
        'water',
        'landscape',
        'viewpoint',
        // Abandoned & industrial
        'abandoned',
        'industrial',
        'military',
        // History & architecture
        'castle',
        'manor',
        'architecture',
        'religious',
        'archeology',
        'engineering',
        'transport',
        // Monuments & art
        'memorial',
        'artwork',
        // Dark & strange
        'disaster',
        'mystic',
        // Leisure
        'museum',
        'camping',
    ];

    /** Whether a string is a known category key */
    public function has(?string $name): bool
    {
        return $name !== null && in_array($name, $this->names, true);
    }
}
