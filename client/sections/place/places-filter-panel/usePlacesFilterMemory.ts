import { useCallback, useEffect, useState } from 'react'

import { ApiModel } from '@/api'

const RECENT_KEY = 'places-recent-locations'
const LAST_KEY = 'places-last-search'
const RECENT_LIMIT = 3

/** The last filtered listing: its URL and the summary for the "Продолжить: …" chip */
export interface LastPlacesSearch {
    href: string
    label: string
}

const read = <T>(key: string): T | null => {
    try {
        return JSON.parse(window.localStorage.getItem(key) ?? 'null') as T | null
    } catch {
        return null
    }
}

const write = (key: string, value: unknown) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // Private mode or blocked storage: the listing works the same, it just forgets
    }
}

/**
 * What the places listing remembers in this browser: the last three picked locations (the
 * first rows of "Где") and the last filtered search (the "Продолжить: …" chip on a clean
 * `/places`). Remembered, never applied by itself: the URL is the only state of a listing.
 */
export const usePlacesFilterMemory = () => {
    // Read after mount: the server render has no storage, the first client render must match it
    const [recentLocations, setRecentLocations] = useState<ApiModel.AddressItem[]>([])
    const [lastSearch, setLastSearch] = useState<LastPlacesSearch | null>(null)

    useEffect(() => {
        setRecentLocations(read<ApiModel.AddressItem[]>(RECENT_KEY) ?? [])
        setLastSearch(read<LastPlacesSearch>(LAST_KEY))
    }, [])

    const rememberLocation = useCallback((location: ApiModel.AddressItem) => {
        const next = [
            location,
            ...(read<ApiModel.AddressItem[]>(RECENT_KEY) ?? []).filter(
                (item) => !(item.id === location.id && item.type === location.type)
            )
        ].slice(0, RECENT_LIMIT)

        write(RECENT_KEY, next)
        setRecentLocations(next)
    }, [])

    const rememberSearch = useCallback((search: LastPlacesSearch) => write(LAST_KEY, search), [])

    return { lastSearch, recentLocations, rememberLocation, rememberSearch }
}
