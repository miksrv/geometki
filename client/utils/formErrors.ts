import type { FieldErrors, FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { getErrorMessage, isApiValidationErrors } from '@/utils/api'
import { scrollToFirstError } from '@/utils/scrollToFirstError'

export interface ServerFormErrors<F extends string> {
    /** Messages of the fields the form has, to go under them */
    fields: Partial<Record<F, string>>
    /** Everything else (`messages.error`, a field the form lacks, a plain failure) for the top of the form */
    message?: string
}

/**
 * Splits an API error (`{ messages: { <field>: string, error?: string } }`) into what belongs
 * under the form's `fields` and what is said at its top. An answer of another shape gives its
 * plain message.
 */
export const parseServerErrors = <F extends string>(error: unknown, fields: readonly F[]): ServerFormErrors<F> => {
    if (!isApiValidationErrors<Record<string, unknown>>(error)) {
        return { fields: {}, message: getErrorMessage(error) }
    }

    const result: ServerFormErrors<F> = { fields: {} }
    const rest: string[] = []

    for (const [name, message] of Object.entries(error.messages)) {
        if ((fields as readonly string[]).includes(name)) {
            result.fields[name as F] = String(message)
        } else {
            rest.push(String(message))
        }
    }

    result.message = rest.join(' ') || undefined

    return result
}

/**
 * Puts the server's field messages on the form's fields and brings the first of them (in the
 * page order) to the middle of the screen (DESIGN.md → Form state and unsaved changes).
 */
export const applyServerErrors = <T extends FieldValues>(
    setError: UseFormSetError<T>,
    fields: Partial<Record<string, string>>
): void => {
    const entries = Object.entries(fields).filter((entry): entry is [string, string] => !!entry[1])

    entries.forEach(([name, message]) => setError(name as Path<T>, { message, type: 'server' }))

    scrollToFirstError(
        Object.fromEntries(entries.map(([name, message]) => [name, { message, type: 'server' }])) as FieldErrors
    )
}
