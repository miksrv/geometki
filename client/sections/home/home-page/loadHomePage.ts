import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { HOME_COLLECTIONS_COUNT } from '@/sections/home'
import { dropFromHydration } from '@/utils/hydration'
import { loadPageTranslations } from '@/utils/translations.server'

import type { HomePageProps } from '.'
import {
    HOME_COLLECTION_MIN_PLACES,
    HOME_COUNTRY_ID,
    HOME_FEED_LIMIT,
    HOME_GUEST_FEED_LIMIT,
    HOME_PLACES_LIMIT,
    HOME_REGIONS_LIMIT
} from './HomePage'

interface LoadHomePageOptions {
    locale?: string
    /** The visitor's point (a live render), for the distances on the place cards */
    visitorLocation?: ApiType.Coordinates
}

/**
 * The data of the home page, for both of its routes: the cached guest page (`pages/index.tsx`)
 * and the per-request one (`pages/live/index.tsx`: a signed-in user, after
 * `hydrateAuthFromCookies`, or a guest with their point). Server only.
 */
export const loadHomePage = async (
    store: AppStore,
    { locale: contextLocale, visitorLocation }: LoadHomePageOptions
): Promise<{ props: HomePageProps; failed: boolean }> => {
    const locale = (contextLocale ?? 'en') as ApiType.Locale
    const translations = await loadPageTranslations()

    store.dispatch(setLocale(locale))

    const signedIn = !!store.getState().auth.isAuth

    // The welcome panel needs the user's statistic, which only the profile carries: the
    // id comes from `auth/me`, then the profile; both run alongside the other requests
    const loadCurrentUser = async (): Promise<ApiModel.User | undefined> => {
        const { data: me } = await store.dispatch(API.endpoints.authGetMe.initiate())

        if (!me?.user?.id) {
            return undefined
        }

        const { data: profile } = await store.dispatch(API.endpoints.usersGetItem.initiate(me.user.id))

        // The profile's level is counted after the server re-checks it: the fresher one
        return { ...me.user, ...profile, levelData: profile?.levelData ?? me.user.levelData }
    }

    // Everything but the signed-in user's profile goes to the page as props, no hook asks for
    // it: the requests are kept to drop their answers from the hydrated store
    const requests = {
        collections: store.dispatch(API.endpoints.collectionsGetList.initiate({ limit: 12, sort: 'popular' })),
        feed: store.dispatch(
            API.endpoints.feedGetStories.initiate({
                limit: signedIn ? HOME_FEED_LIMIT : HOME_GUEST_FEED_LIMIT,
                weight: 2
            })
        ),
        feedPulse: store.dispatch(API.endpoints.feedGetPulse.initiate()),
        latest: store.dispatch(
            API.endpoints.placesGetList.initiate({
                ...visitorLocation,
                limit: HOME_PLACES_LIMIT,
                order: ApiType.SortOrders.DESC,
                sort: ApiType.SortFields.Created
            })
        ),
        popular: store.dispatch(
            API.endpoints.placesGetList.initiate({
                ...visitorLocation,
                limit: HOME_PLACES_LIMIT,
                order: ApiType.SortOrders.DESC,
                sort: ApiType.SortFields.ViewsWeek
            })
        ),
        // Only the guest page has the regions block
        regions: signedIn
            ? undefined
            : store.dispatch(API.endpoints.locationsGetChildren.initiate({ id: HOME_COUNTRY_ID, type: 'country' })),
        stats: store.dispatch(API.endpoints.statsGetSummary.initiate()),
        users: store.dispatch(API.endpoints.usersGetList.initiate({ limit: 15 }))
    }

    const [
        currentUser,
        { data: popular, isError: failed },
        { data: latest },
        { data: usersList },
        { data: stats },
        { data: feed },
        { data: feedPulse },
        { data: collections },
        regions
    ] = await Promise.all([
        signedIn ? loadCurrentUser() : Promise.resolve(undefined),
        requests.popular,
        requests.latest,
        requests.users,
        requests.stats,
        requests.feed,
        requests.feedPulse,
        requests.collections,
        requests.regions
    ])

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    dropFromHydration(store, ...Object.values(requests))

    return {
        // The API did not answer: the cached page should not take this one's place
        failed: !!failed,
        props: {
            ...translations,
            collections: (collections?.items ?? [])
                .filter((item) => item.placesCount >= HOME_COLLECTION_MIN_PLACES && item.covers?.length)
                .slice(0, HOME_COLLECTIONS_COUNT),
            currentUser: currentUser ?? null,
            feedPulse: feedPulse ?? null,
            feedStories: feed?.items || [],
            latestPlaces: latest?.items || [],
            popularPlaces: popular?.items || [],
            regions: (regions?.data?.items ?? []).slice(0, HOME_REGIONS_LIMIT),
            stats: stats ?? null,
            usersList: usersList?.items || []
        }
    }
}
