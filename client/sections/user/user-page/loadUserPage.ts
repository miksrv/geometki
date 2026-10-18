import { API, ApiType } from '@/api'
import { setLocale, setTimeZone } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { dropFromHydration } from '@/utils/hydration'
import { loadPageTranslations } from '@/utils/translations.server'

import type { UserPageProps } from './UserPage'

interface LoadUserPageOptions {
    param?: string | string[]
    locale?: string
    /** The visitor's zone for the calendar days: a live render only, the cached page has the site's days */
    timeZone?: string
}

/**
 * The data of a user profile, for both of its routes: the cached one of guests in the site's
 * zone (`pages/users/[id]/index.tsx`) and the per-request one (`pages/live/users/[id].tsx`).
 * Server only. Throws when the API fails on anything but a missing user.
 */
export const loadUserPage = async (
    store: AppStore,
    { param, locale, timeZone }: LoadUserPageOptions
): Promise<{ props: UserPageProps } | { notFound: true }> => {
    const id = typeof param === 'string' ? param : undefined
    const translations = await loadPageTranslations()

    if (!id) {
        return { notFound: true }
    }

    store.dispatch(setLocale((locale ?? 'en') as ApiType.Locale))
    store.dispatch(setTimeZone(timeZone))

    const userRequest = store.dispatch(API.endpoints.usersGetItem.initiate(id))
    const { data: userData, error } = await userRequest

    // A missing user costs one request, not five
    if (error || !userData) {
        // A failing API (5xx, no answer) is not a missing user: a cached page stays as it was
        if (error && !('status' in error && typeof error.status === 'number' && error.status < 500)) {
            throw new Error(`User ${id} not loaded: ${JSON.stringify(error)}`)
        }

        return { notFound: true }
    }

    // The rest at once; the achievements of the header too, else the browser asks for them
    const photosRequest = store.dispatch(API.endpoints.photosGetList.initiate({ author: id, limit: 8, offset: 0 }))
    const [{ data: photosData }] = await Promise.all([
        photosRequest,
        store.dispatch(API.endpoints.feedGetList.initiate({ author: id })),
        store.dispatch(API.endpoints.feedGetCalendar.initiate({ author: id, tz: timeZone })),
        store.dispatch(API.endpoints.getUserAchievements.initiate(userData.id))
    ])

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    // The user and the photos go to the page as props, no hook asks for them
    dropFromHydration(store, userRequest, photosRequest)

    return {
        props: {
            ...translations,
            id,
            photosCount: photosData?.count ?? 0,
            photosList: photosData?.items ?? [],
            user: userData
        }
    }
}
