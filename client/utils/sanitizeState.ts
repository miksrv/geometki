/**
 * Recursively sanitizes an object for JSON serialization by:
 * - Converting undefined values to null
 * - Handling nested objects and arrays
 *
 * This is needed because Next.js getServerSideProps cannot serialize undefined values.
 */
export function sanitizeForSerialization<T>(obj: T): T {
    if (obj === undefined) {
        return null as unknown as T
    }

    if (obj == null || typeof obj !== 'object') {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeForSerialization(item)) as unknown as T
    }

    const result: Record<string, unknown> = {}

    for (const key of Object.keys(obj)) {
        const value = (obj as Record<string, unknown>)[key]

        if (value === undefined) {
            // Skip undefined values entirely (omit from result)
            continue
        }

        result[key] = sanitizeForSerialization(value)
    }

    return result as T
}
