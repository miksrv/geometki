import { useCallback, useEffect, useState } from 'react'

import { ApiModel } from '@/api'

const STORAGE_KEY = 'site-search-recent'
const LIMIT = 6

/** What the site search remembers: a typed query, or an opened suggestion with its link */
export type SearchHistoryEntry =
    | { kind: 'query'; label: string }
    | {
          kind: 'place' | 'area' | 'address'
          label: string
          caption?: string
          href: string
          category?: ApiModel.Categories | null
      }

const keyOf = (entry: SearchHistoryEntry) =>
    entry.kind === 'query' ? `query:${entry.label.toLowerCase()}` : `link:${entry.href}`

const read = (): SearchHistoryEntry[] => {
    try {
        const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown

        return Array.isArray(value) ? (value as SearchHistoryEntry[]).filter((entry) => entry?.label) : []
    } catch {
        return []
    }
}

const write = (entries: SearchHistoryEntry[]) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
        // Private mode or blocked storage: the search works the same, it just forgets
    }
}

/**
 * The last six searches of this browser (`localStorage`): the "Недавние" of the site search
 * before anything is typed. A repeated entry moves to the top.
 */
const useSearchHistory = () => {
    // Read after mount: the server render has no storage, the first client render must match it
    const [entries, setEntries] = useState<SearchHistoryEntry[]>([])

    useEffect(() => setEntries(read()), [])

    const remember = useCallback((entry: SearchHistoryEntry) => {
        const next = [entry, ...read().filter((item) => keyOf(item) !== keyOf(entry))].slice(0, LIMIT)

        write(next)
        setEntries(next)
    }, [])

    const refresh = useCallback(() => setEntries(read()), [])

    const clear = useCallback(() => {
        write([])
        setEntries([])
    }, [])

    return { clear, entries, keyOf, refresh, remember }
}

export default useSearchHistory
