import type { FieldErrors, FieldValues } from 'react-hook-form'

/** The dotted names of the fields with an error: `settings.emailPlace` for a nested one */
export const errorFieldNames = (errors: FieldErrors<FieldValues> | undefined, prefix = ''): string[] =>
    Object.entries(errors ?? {}).flatMap(([key, value]) => {
        if (!value || typeof value !== 'object') {
            return []
        }

        const name = prefix ? `${prefix}.${key}` : key

        // A leaf error has a type; anything else is a group of fields (an object or an array)
        return 'type' in value ? [name] : errorFieldNames(value as FieldErrors<FieldValues>, name)
    })

/**
 * Brings the first field with an error (in the page order) to the middle of the screen and
 * focuses it (DESIGN.md → Patterns → Form state). Fields are found by their `name`: the kit
 * fields do not forward refs, so react-hook-form's own `shouldFocusError` cannot reach them.
 * Pass it as the second argument of `handleSubmit`; returns whether a field was found.
 */
export const scrollToFirstError = (
    errors: FieldErrors<FieldValues> | undefined,
    root: ParentNode | undefined = typeof document === 'undefined' ? undefined : document
): boolean => {
    if (!root) {
        return false
    }

    const first = errorFieldNames(errors)
        .map((name) => root.querySelector<HTMLElement>(`[name="${name.replace(/"/g, '\\"')}"]`))
        .filter((field): field is HTMLElement => !!field)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0]

    if (!first) {
        return false
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    first.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    first.focus({ preventScroll: true })

    return true
}
