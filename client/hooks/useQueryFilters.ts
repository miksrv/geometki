import { useCallback, useMemo } from 'react'

import { useRouter } from 'next/router'

export type QueryFilters<K extends string> = Partial<Record<K, string>>

/**
 * The filters of a list kept in the page's query (`?status=error&page=2`), so that a filtered
 * list can be reloaded, sent as a link and returned to with "back". Reads the named keys from
 * the URL; `setFilters` merges a patch into it (an empty value removes the key) with a shallow
 * `replace` — no `getServerSideProps`, no new history entry, the scroll stays.
 */
export const useQueryFilters = <K extends string>(
    keys: readonly K[]
): [QueryFilters<K>, (patch: Partial<Record<K, string | number | undefined>>) => void] => {
    const router = useRouter()

    const filters = useMemo(() => {
        const result: QueryFilters<K> = {}

        keys.forEach((key) => {
            const value = router.query[key]

            if (typeof value === 'string' && value !== '') {
                result[key] = value
            }
        })

        return result
        // The keys are a constant list of the page: only the URL changes what is read
    }, [router.query])

    const setFilters = useCallback(
        (patch: Partial<Record<K, string | number | undefined>>) => {
            const query: Record<string, string | string[] | undefined> = { ...router.query }

            Object.entries(patch).forEach(([key, value]) => {
                if (value === undefined || value === '') {
                    delete query[key]
                } else {
                    query[key] = String(value)
                }
            })

            void router.replace({ pathname: router.pathname, query }, undefined, { scroll: false, shallow: true })
        },
        [router]
    )

    return [filters, setFilters]
}
