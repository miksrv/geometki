import { useRef } from 'react'

/**
 * The value, or the last one it had while it is gone: an edit page keeps showing its entity
 * while the list refetches after a delete, instead of flashing "not found" on the way out.
 */
export const useLastDefined = <T>(value: T | undefined): T | undefined => {
    const last = useRef<T | undefined>(value)

    if (value !== undefined) {
        last.current = value
    }

    return value ?? last.current
}
