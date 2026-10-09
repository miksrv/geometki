<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The place category keys the API accepts and reports. This is the whole
 * server-side knowledge of categories: names, descriptions, icons and
 * landing-page titles live in the client (client/config/categories.ts and
 * its i18n files), so adding or renaming a category's wording never touches
 * the server. Adding a category means adding its key here and in the client
 * catalogue; `places.category` is validated against this list.
 */
class Categories extends BaseConfig
{
    /** @var string[] */
    public array $names = [
        'abandoned',
        'animals',
        'archeology',
        'bridge',
        'camping',
        'castle',
        'cave',
        'construction',
        'death',
        'manor',
        'memorial',
        'military',
        'mine',
        'monument',
        'mountain',
        'museum',
        'nature',
        'radiation',
        'religious',
        'spring',
        'transport',
        'water',
        'waterfall',
    ];

    /** Whether a string is a known category key */
    public function has(?string $name): bool
    {
        return $name !== null && in_array($name, $this->names, true);
    }
}
