<?php

namespace App\Libraries;

/**
 * The input of the place form (POST /places, PATCH /places/:id): cleaned first, then checked,
 * so a limit holds for what is saved — a title of HTML tags is no title once they are stripped.
 *
 * The title and the description are plain text and markdown: every HTML tag is stripped, the
 * entities decoded, the ends trimmed. The coordinates are finite numbers on the globe. Any
 * field of another type than expected (an array for the title, say) is an error, not a crash.
 * The client keeps the same limits (client/sections/place/place-form/PlaceForm.tsx).
 */
final class PlaceInput
{
    public const TITLE_MIN   = 8;
    public const TITLE_MAX   = 200;
    public const CONTENT_MAX = 20000;
    /** `places_content.content` is a TEXT column */
    public const CONTENT_MAX_BYTES = 65535;

    /** HTML stripped, entities decoded, the ends trimmed */
    public static function clean(string $text): string
    {
        return trim(strip_tags(html_entity_decode($text)));
    }

    /**
     * The request body as an array, its title and description cleaned; a field of another type
     * than a string is left as it is for the checks to refuse
     *
     * @return array<string, mixed>
     */
    public static function sanitize(mixed $input): array
    {
        $data = is_object($input) || is_array($input) ? (array) $input : [];

        foreach (['title', 'content'] as $field) {
            if (isset($data[$field]) && is_string($data[$field])) {
                $data[$field] = self::clean($data[$field]);
            }
        }

        return $data;
    }

    /**
     * The validation rules of the text fields: on create the title and the category are
     * required, on update every field is optional and checked only when given
     *
     * @return array<string, string>
     */
    public static function rules(bool $create): array
    {
        $optional   = $create ? '' : 'if_exist|';
        $categories = implode(',', config('Categories')->names);

        return [
            'title'     => $optional . 'required|string|min_length[' . self::TITLE_MIN . ']|max_length[' . self::TITLE_MAX . ']',
            'category'  => $optional . 'required|string|in_list[' . $categories . ']',
            'content'   => 'permit_empty|string|max_length[' . self::CONTENT_MAX . ']',
            'candidate' => 'permit_empty|string|max_length[32]',
        ];
    }

    /** @return array<string, array<string, string>> */
    public static function messages(): array
    {
        return [
            'title' => [
                'required'   => lang('Places.titleRequired'),
                'string'     => lang('Places.titleRequired'),
                'min_length' => lang('Places.titleTooShort', [self::TITLE_MIN]),
                'max_length' => lang('Places.titleTooLong', [self::TITLE_MAX]),
            ],
            'category' => [
                'required' => lang('Places.categoryRequired'),
                'string'   => lang('Places.categoryRequired'),
                'in_list'  => lang('Places.categoryRequired'),
            ],
            'content' => [
                'string'     => lang('Places.contentTooLong', [self::CONTENT_MAX]),
                'max_length' => lang('Places.contentTooLong', [self::CONTENT_MAX]),
            ],
        ];
    }

    /**
     * The checks the rules cannot make: the coordinates (required on create), the description's
     * bytes, the photos as a list. Field => message, empty when all is right
     *
     * @param array<string, mixed> $data
     *
     * @return array<string, string>
     */
    public static function errors(array $data, bool $create): array
    {
        $errors = [];

        foreach (['lat' => 90, 'lon' => 180] as $field => $limit) {
            if (!array_key_exists($field, $data) || $data[$field] === null) {
                if ($create) {
                    $errors[$field] = lang('Places.coordinatesRequired');
                }

                continue;
            }

            if (!self::isCoordinate($data[$field], $limit)) {
                $errors[$field] = lang('Places.coordinatesInvalid');
            }
        }

        // `permit_empty` lets an empty array or `false` through: a description is a string or nothing
        if (isset($data['content']) && !is_string($data['content'])) {
            $errors['content'] = lang('Places.contentTooLong', [self::CONTENT_MAX]);
        } elseif (isset($data['content']) && strlen($data['content']) > self::CONTENT_MAX_BYTES) {
            $errors['content'] = lang('Places.contentTooLong', [self::CONTENT_MAX]);
        }

        if (isset($data['photos']) && !is_array($data['photos'])) {
            $errors['photos'] = lang('Places.photosInvalid');
        }

        return $errors;
    }

    /** A finite number (or a numeric string) within ±$limit */
    public static function isCoordinate(mixed $value, int $limit): bool
    {
        if (is_string($value) && is_numeric($value)) {
            $value = (float) $value;
        }

        if (!is_int($value) && !is_float($value)) {
            return false;
        }

        return is_finite((float) $value) && abs((float) $value) <= $limit;
    }
}
