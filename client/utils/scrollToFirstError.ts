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

// What takes the focus inside a field found by `data-field` (a select's trigger, an editor)
const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

const findField = (root: ParentNode, name: string): HTMLElement | null => {
    const quoted = name.replace(/"/g, '\\"')

    return root.querySelector<HTMLElement>(`[name="${quoted}"], [data-field~="${quoted}"]`)
}

/**
 * Brings the first field with an error (in the page order) to the middle of the screen and
 * focuses it (DESIGN.md → Patterns → Form state). A field is found by its `name`, or by
 * `data-field` on a field without an input of its own (a select, an editor, the map that sets
 * `lat` and `lon`: `data-field="lat lon"`): the kit fields do not forward refs, so
 * react-hook-form's own `shouldFocusError` cannot reach them. Pass it as the second argument
 * of `handleSubmit`; returns whether a field was found.
 */
export const scrollToFirstError = (
    errors: FieldErrors<FieldValues> | undefined,
    root: ParentNode | undefined = typeof document === 'undefined' ? undefined : document
): boolean => {
    if (!root) {
        return false
    }

    const first = errorFieldNames(errors)
        .map((name) => findField(root, name))
        .filter((field): field is HTMLElement => !!field)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0]

    if (!first) {
        return false
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const focusTarget = first.matches(FOCUSABLE) ? first : first.querySelector<HTMLElement>(FOCUSABLE)

    first.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    focusTarget?.focus({ preventScroll: true })

    return true
}
