import { API, ApiType } from '@/api'
import { setLocale, setTimeZone } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { FeedFilter } from '@/utils/feed'
import { loadPageTranslations } from '@/utils/translations.server'

import type { ActivityPageProps } from '.'
import { feedRequest } from './ActivityPage'

interface LoadActivityPageOptions {
    locale?: string
    /** `?type=`: a live render only, the cached page is the whole feed */
    filter?: FeedFilter | null
    /** The visitor's zone for the day headings: a live render only, the cached page has the site's days */
    timeZone?: string
}

/**
 * The data of the activity feed, for both of its routes: the cached page of guests in the
 * site's zone (`pages/activity.tsx`) and the per-request one (`pages/live/activity.tsx`).
 * Server only.
 */
export const loadActivityPage = async (
    store: AppStore,
    { locale, filter = null, timeZone }: LoadActivityPageOptions
): Promise<{ props: ActivityPageProps; failed: boolean }> => {
    const translations = await loadPageTranslations()

    store.dispatch(setLocale((locale ?? 'en') as ApiType.Locale))
    store.dispatch(setTimeZone(timeZone))

    const [feed] = await Promise.all([
        store.dispatch(API.endpoints.feedGetList.initiate(feedRequest(filter))),
        store.dispatch(API.endpoints.feedGetPulse.initiate())
    ])

    // The API did not answer: the cached page should not take this one's place
    return { failed: !!feed.isError, props: { ...translations, filter } }
}
