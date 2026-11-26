import { API, ApiModel, ApiType } from '@/api'
import { setLocale, setTimeZone } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { HOME_COLLECTIONS_COUNT } from '@/sections/home'
import { dropFromHydration } from '@/utils/hydration'
import { loadPageTranslations } from '@/utils/translations.server'

import type { HomePageProps } from '.'
import {
    HOME_COLLECTION_MIN_PLACES,
    HOME_COUNTRY_ID,
    HOME_FEED_LIMIT,
    HOME_PLACES_LIMIT,
    HOME_QUESTS_LIMIT,
    HOME_REGIONS_LIMIT,
    HOME_USERS_LIMIT
} from './HomePage'

interface LoadHomePageOptions {
    locale?: string
    /** The visitor's point (a live render), for the distances on the place cards */
    visitorLocation?: ApiType.Coordinates
    /** The visitor's zone (a live render): the days of the signed-in card's week and run of days */
    timeZone?: string
}

/**
 * The data of the home page, for both of its routes: the cached guest page (`pages/index.tsx`)
 * and the per-request one (`pages/live/index.tsx`: a signed-in user, after
 * `hydrateAuthFromCookies`, or a guest with their point). Server only.
 */
export const loadHomePage = async (
    store: AppStore,
    { locale: contextLocale, visitorLocation, timeZone }: LoadHomePageOptions
): Promise<{ props: HomePageProps; failed: boolean }> => {
    const locale = (contextLocale ?? 'en') as ApiType.Locale
    const translations = await loadPageTranslations()

    store.dispatch(setLocale(locale))
    store.dispatch(setTimeZone(timeZone))

    const signedIn = !!store.getState().auth.isAuth

    // The welcome panel needs the user's statistic, which only the profile carries: the
    // id comes from `auth/me`, then the profile; both run alongside the other requests
    const loadCurrentUser = async (): Promise<ApiModel.User | undefined> => {
        const { data: me } = await store.dispatch(API.endpoints.authGetMe.initiate())

        if (!me?.user?.id) {
            return undefined
        }

        // The calendar too: the card's line of the week comes from it (kept for the hook)
        const [{ data: profile }] = await Promise.all([
            store.dispatch(API.endpoints.usersGetItem.initiate(me.user.id)),
            store.dispatch(
                API.endpoints.feedGetCalendar.initiate({
                    author: me.user.id,
                    tz: store.getState().application.timeZone
                })
            )
        ])

        // The profile's level is counted after the server re-checks it: the fresher one
        return { ...me.user, ...profile, levelData: profile?.levelData ?? me.user.levelData }
    }

    // Everything but the signed-in user's profile goes to the page as props, no hook asks for
    // it: the requests are kept to drop their answers from the hydrated store
    const requests = {
        collections: store.dispatch(API.endpoints.collectionsGetList.initiate({ limit: 12, sort: 'popular' })),
        feed: store.dispatch(
            API.endpoints.feedGetStories.initiate({
                limit: HOME_FEED_LIMIT,
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
        // The first tab of "Куда поехать": the week's popular places for a guest, the ones
        // picked by the interests and not explored yet for a signed-in user
        popular: signedIn
            ? undefined
            : store.dispatch(
                  API.endpoints.placesGetList.initiate({
                      ...visitorLocation,
                      limit: HOME_PLACES_LIMIT,
                      order: ApiType.SortOrders.DESC,
                      sort: ApiType.SortFields.ViewsWeek
                  })
              ),
        recommended: signedIn
            ? store.dispatch(
                  API.endpoints.placesGetList.initiate({
                      ...visitorLocation,
                      limit: HOME_PLACES_LIMIT,
                      notVisited: 1,
                      sort: ApiType.SortFields.Recommended
                  })
              )
            : undefined,
        // Only the guest page has the regions block
        regions: signedIn
            ? undefined
            : store.dispatch(API.endpoints.locationsGetChildren.initiate({ id: HOME_COUNTRY_ID, type: 'country' })),
        // The quests the signed-in user has not walked to the end, the ones being walked first:
        // the walk to go on with, or how many quests wait
        quests: signedIn
            ? store.dispatch(
                  API.endpoints.questsGetList.initiate({ ...visitorLocation, limit: HOME_QUESTS_LIMIT, walk: 'todo' })
              )
            : undefined,
        // The guest page's game block: the season and how many play, the same for every guest
        // (the signed-in page asks for its own `rivals` answer, kept for the hook)
        game: signedIn ? undefined : store.dispatch(API.endpoints.gameGet.initiate()),
        stats: store.dispatch(API.endpoints.statsGetSummary.initiate()),
        users: store.dispatch(API.endpoints.usersGetList.initiate({ limit: HOME_USERS_LIMIT }))
    }

    // The season card of the signed-in page asks for it by its hook: kept in the hydrated store,
    // so the card is in the server's HTML and does not push the page down when it comes
    if (signedIn) {
        void store.dispatch(API.endpoints.gameGet.initiate({ rivals: true }))
    }

    const answers = await Promise.all([
        signedIn ? loadCurrentUser() : Promise.resolve(undefined),
        requests.popular,
        requests.latest,
        requests.users,
        requests.stats,
        requests.feed,
        requests.feedPulse,
        requests.collections,
        requests.regions,
        requests.recommended,
        requests.quests,
        requests.game
    ])
    const [
        currentUser,
        popular,
        { data: latest },
        { data: usersList },
        { data: stats },
        { data: feed },
        { data: feedPulse },
        { data: collections },
        regions,
        recommended,
        quests,
        game
    ] = answers
    // Any block without its answer: a cached page with a hole should not take a full one's place
    const failed = answers.slice(1).some((answer) => !!answer && 'isError' in answer && answer.isError)

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    const questItems = quests?.data?.items ?? []

    dropFromHydration(store, ...Object.values(requests))

    return {
        failed,
        props: {
            ...translations,
            collections: (collections?.items ?? [])
                .filter((item) => item.placesCount >= HOME_COLLECTION_MIN_PLACES && item.covers?.length)
                .slice(0, HOME_COLLECTIONS_COUNT),
            currentUser: currentUser ?? null,
            feedPulse: feedPulse ?? null,
            feedStories: feed?.items || [],
            game: game?.data ?? null,
            latestPlaces: latest?.items || [],
            popularPlaces: popular?.data?.items || [],
            recommendedPlaces: recommended ? (recommended.data?.items ?? []) : null,
            regions: (regions?.data?.items ?? []).slice(0, HOME_REGIONS_LIMIT),
            questWalk: questItems.find(({ walk }) => !!walk && !walk.finished) ?? null,
            questsCount: quests?.data?.count ?? 0,
            questsCover: questItems.find(({ cover }) => !!cover)?.cover?.full ?? null,
            stats: stats ?? null,
            usersList: usersList?.items || []
        }
    }
}
