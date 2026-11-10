/**
 * The user's display name rule, a mirror of the API's (server `App\Libraries\UserName`,
 * `Config\Users`): at most `USER_NAME_MAX` characters, at least `USER_NAME_MIN` letters or digits,
 * only letters, digits, spaces and `. - _ ' ’ ( )`. Names are not unique.
 */

/** Fewest letters or digits a name must hold ("Ян" is a name). */
export const USER_NAME_MIN = 2

/** Most characters in a name. */
export const USER_NAME_MAX = 40

export type UserNameError = 'too-short' | 'too-long' | 'invalid-chars'

const INVALID_CHAR = /[^\p{L}\p{M}\p{N} .\-_'’()]/u
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/gu

/** Drops control and invisible characters, collapses whitespace into single spaces, trims. */
export const normalizeUserName = (name?: string | null): string =>
    (name ?? '')
        .normalize('NFC')
        .replace(/\s+/gu, ' ')
        .replace(/\p{C}+/gu, '')
        .replace(/ {2,}/g, ' ')
        .trim()

/** What is wrong with a name (checked as it will be saved), or `undefined` for a valid one. */
export const validateUserName = (name?: string | null): UserNameError | undefined => {
    const value = normalizeUserName(name)

    if ([...value].length > USER_NAME_MAX) {
        return 'too-long'
    }

    if (INVALID_CHAR.test(value)) {
        return 'invalid-chars'
    }

    if ((value.match(LETTER_OR_DIGIT)?.length ?? 0) < USER_NAME_MIN) {
        return value ? 'too-short' : undefined
    }

    return undefined
}

/** The `common.json` key of each error's text (takes `min` and `max`). */
export const USER_NAME_ERROR_KEYS: Record<UserNameError, string> = {
    'invalid-chars': 'error_name-invalid-chars',
    'too-long': 'error_name-too-long',
    'too-short': 'error_name-too-short'
}
