<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The one-tap questions a visitor answers after a check-in (features/25-visits-and-exploration.md,
 * step 2): a closed list, like the categories. Keys and values live here; the texts are on the
 * client (`common.json` → `visitQuestions.<key>`, `visitFeatures.<key>`). The answers feed
 * "How it is now" on the place page (VisitsLibrary::now(), table `places_now`) and the
 * recommendations (UserInterestProfilesModel).
 *
 * Two kinds: the questions (one value each: `road` → `dirt`) and the features, "what can you
 * do here" (`can`): each feature is a yes/no question of its own, stored as `can_<feature>`
 * → `yes` | `no`, asked together as the last step.
 *
 * A category has a pool of six to eight questions, and a visit asks PER_VISIT of them: the
 * ones the place has no answer to yet, then the stale and the contested ones
 * (VisitsLibrary::questionsFor()), so the pool fills up visit by visit and nobody is asked
 * everything at once.
 *
 * A new question, value or feature touches this file and both client locales; the client's
 * catalogue (`api/models/visitQuestion.ts`) lists the same keys and values.
 */
class VisitQuestions extends BaseConfig
{
    /** How many questions a visit asks (the features step is one more) */
    public const PER_VISIT = 3;

    /** @var array<string, string[]> question key => allowed values */
    public array $values = [
        'road'       => ['asphalt', 'dirt', 'offroad', 'foot', 'water'],
        'walk'       => ['short', 'medium', 'long'],
        'trail'      => ['marked', 'faint', 'none'],
        'entry'      => ['free', 'paid', 'guarded', 'outside', 'closed'],
        'state'      => ['intact', 'decaying', 'demolished'],
        'water'      => ['present', 'dry'],
        'crowd'      => ['empty', 'some', 'crowded'],
        'time'       => ['hour', 'half', 'day'],
        'parking'    => ['near', 'far', 'none'],
        'cell'       => ['good', 'weak', 'none'],
        'facilities' => ['none', 'basic', 'full'],
        'safety'     => ['safe', 'care', 'danger'],
        'access'     => ['full', 'partial', 'none'],
    ];

    /**
     * The pool of each category, the practical questions first: that is the order they are
     * asked in while the place has no answers.
     *
     * @var array<string, string[]>
     */
    public array $categories = [
        'mountain'     => ['road', 'walk', 'trail', 'time', 'crowd', 'entry', 'cell', 'facilities'],
        'cave'         => ['road', 'walk', 'trail', 'entry', 'safety', 'time', 'crowd', 'cell'],
        'waterfall'    => ['road', 'walk', 'water', 'trail', 'entry', 'crowd', 'time', 'facilities'],
        'spring'       => ['road', 'walk', 'water', 'crowd', 'facilities', 'time', 'cell'],
        'water'        => ['road', 'water', 'crowd', 'facilities', 'parking', 'time', 'cell'],
        'landscape'    => ['road', 'walk', 'trail', 'time', 'crowd', 'cell', 'facilities'],
        'viewpoint'    => ['road', 'walk', 'trail', 'crowd', 'time', 'parking', 'access'],
        'abandoned'    => ['road', 'entry', 'state', 'safety', 'crowd', 'cell', 'time', 'parking'],
        'industrial'   => ['road', 'entry', 'state', 'safety', 'crowd', 'cell', 'time', 'parking'],
        'military'     => ['road', 'entry', 'state', 'safety', 'crowd', 'cell', 'time', 'parking'],
        'castle'       => ['road', 'entry', 'state', 'parking', 'time', 'crowd', 'access', 'facilities'],
        'manor'        => ['road', 'entry', 'state', 'parking', 'time', 'crowd', 'access', 'facilities'],
        'architecture' => ['road', 'entry', 'state', 'parking', 'time', 'crowd', 'access'],
        'religious'    => ['road', 'entry', 'state', 'parking', 'access', 'crowd', 'time'],
        'archeology'   => ['road', 'walk', 'trail', 'state', 'entry', 'crowd', 'time', 'cell'],
        'engineering'  => ['road', 'entry', 'state', 'parking', 'safety', 'time', 'crowd'],
        'transport'    => ['road', 'entry', 'state', 'parking', 'time', 'crowd'],
        'memorial'     => ['road', 'state', 'parking', 'access', 'crowd', 'time'],
        'artwork'      => ['road', 'state', 'parking', 'access', 'crowd', 'time'],
        'disaster'     => ['road', 'walk', 'entry', 'safety', 'state', 'cell', 'crowd', 'time'],
        'mystic'       => ['road', 'walk', 'trail', 'crowd', 'cell', 'time', 'safety'],
        'museum'       => ['entry', 'parking', 'access', 'time', 'crowd', 'facilities'],
        'camping'      => ['road', 'walk', 'facilities', 'water', 'cell', 'crowd', 'time', 'parking'],
    ];

    /** The step of the features in the questions list, and the prefix of their answer keys */
    public const FEATURES = 'can';

    public const FEATURE_PREFIX = 'can_';

    /** @var string[] The features, "what can you do here": yes/no each */
    public array $features = ['swim', 'fish', 'raft', 'beach', 'camp', 'winter', 'ski', 'kids', 'dog', 'drink', 'fire'];

    /**
     * The features asked for each category, at most five, the likeliest first.
     *
     * @var array<string, string[]>
     */
    public array $categoryFeatures = [
        'mountain'     => ['camp', 'winter', 'ski', 'kids', 'drink'],
        'cave'         => ['kids', 'winter', 'camp'],
        'waterfall'    => ['swim', 'camp', 'kids', 'winter', 'drink'],
        'spring'       => ['drink', 'swim', 'camp', 'kids', 'winter'],
        'water'        => ['swim', 'fish', 'raft', 'beach', 'camp'],
        'landscape'    => ['camp', 'kids', 'winter', 'fire', 'dog'],
        'viewpoint'    => ['kids', 'winter', 'camp', 'dog'],
        'abandoned'    => ['kids', 'winter', 'dog'],
        'industrial'   => ['kids', 'winter'],
        'military'     => ['kids', 'winter', 'camp'],
        'castle'       => ['kids', 'dog', 'winter'],
        'manor'        => ['kids', 'dog', 'winter'],
        'architecture' => ['kids', 'dog'],
        'religious'    => ['kids', 'dog'],
        'archeology'   => ['kids', 'camp', 'winter'],
        'engineering'  => ['kids', 'dog'],
        'transport'    => ['kids'],
        'memorial'     => ['kids', 'dog'],
        'artwork'      => ['kids', 'dog'],
        'disaster'     => ['kids', 'winter'],
        'mystic'       => ['camp', 'kids', 'winter', 'fire'],
        'museum'       => ['kids', 'dog'],
        'camping'      => ['swim', 'fish', 'fire', 'kids', 'dog'],
    ];

    /**
     * Questions as the API sends them: `[{ key, values }]` for the keys given and, last,
     * `{ key: 'can', features }` of the category; nothing for an unknown category.
     *
     * @param string[] $keys
     * @return array<int, array{key: string, values?: string[], features?: string[]}>
     */
    public function items(?string $category, array $keys): array
    {
        $items = array_values(array_map(fn (string $key) => ['key' => $key, 'values' => $this->values[$key]], $keys));

        if (!empty($this->categoryFeatures[$category ?? ''])) {
            $items[] = ['key' => self::FEATURES, 'features' => $this->categoryFeatures[$category]];
        }

        return $items;
    }

    /** The whole pool of a category as the API sends it (VisitsLibrary::questionsFor() picks a visit's share) */
    public function forCategory(?string $category): array
    {
        return $this->items($category, $this->categories[$category ?? ''] ?? []);
    }

    /** Whether the key may be answered for a place of the category (a question or `can_<feature>`) */
    public function asks(?string $category, string $question): bool
    {
        $feature = $this->feature($question);

        return $feature !== null
            ? in_array($feature, $this->categoryFeatures[$category ?? ''] ?? [], true)
            : in_array($question, $this->categories[$category ?? ''] ?? [], true);
    }

    /** Whether a question with that value may be answered for a place of the category */
    public function allows(?string $category, string $question, string $value): bool
    {
        if (!$this->asks($category, $question)) {
            return false;
        }

        return $this->feature($question) !== null
            ? in_array($value, ['yes', 'no'], true)
            : in_array($value, $this->values[$question] ?? [], true);
    }

    /** The feature of a `can_<feature>` key, null for a question */
    public function feature(string $question): ?string
    {
        if (!str_starts_with($question, self::FEATURE_PREFIX)) {
            return null;
        }

        $feature = substr($question, strlen(self::FEATURE_PREFIX));

        return in_array($feature, $this->features, true) ? $feature : null;
    }

    /** Every answer key in the order of "How it is now": the questions, then the features */
    public function keys(): array
    {
        return array_merge(array_keys($this->values), array_map(fn (string $f) => self::FEATURE_PREFIX . $f, $this->features));
    }
}
