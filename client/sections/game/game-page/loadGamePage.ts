import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { dropFromHydration } from '@/utils/hydration'
import { loadPageTranslations } from '@/utils/translations.server'

import { GAME_MINE_LIMIT } from '../game-mine'
import { GAME_PLACES_LIMIT } from '../game-places'

import { GAME_LEADERS_LIMIT, GAME_QUESTS_LIMIT } from './constants'
import type { GamePageProps } from './GamePage'

interface LoadGamePageOptions {
    locale?: string
    /** The visitor's point (their location cookie): the valuable places are the nearest ones */
    visitorLocation?: ApiType.Coordinates
}

/**
 * The data of the game page, rendered on every request: all of it depends on the visitor (their
 * score, their walks, the places they have not confirmed). Server only; call after
 * `hydrateAuthFromCookies`.
 */
export const loadGamePage = async (
    store: AppStore,
    { locale: contextLocale, visitorLocation }: LoadGamePageOptions
): Promise<{ props: GamePageProps } | { notFound: true }> => {
    const locale = (contextLocale ?? 'en') as ApiType.Locale
    const translations = await loadPageTranslations()

    store.dispatch(setLocale(locale))

    // Everything goes to the page as props; the hooks ask again only when the visitor changes
    // the scope of the rating, the tab of the places or asks for more of their season
    const requests = {
        game: store.dispatch(API.endpoints.gameGet.initiate()),
        leaders: store.dispatch(API.endpoints.gameGetLeaders.initiate({ limit: GAME_LEADERS_LIMIT })),
        quests: store.dispatch(
            // The ones not walked yet, the nearest start first: a walked quest moves to the profile
            API.endpoints.questsGetList.initiate({ ...visitorLocation, limit: GAME_QUESTS_LIMIT, walk: 'todo' })
        )
    }

    const [game, quests, leaders] = await Promise.all([requests.game, requests.quests, requests.leaders])

    // A player has their own season, the places counted for them; everyone else — a guest,
    // someone without a counted place — is told where to go
    const playing = game.data?.me?.place != null
    const own = playing
        ? { mine: store.dispatch(API.endpoints.gameGetMine.initiate({ limit: GAME_MINE_LIMIT })) }
        : {
              places: store.dispatch(
                  API.endpoints.gameGetPlaces.initiate({ ...visitorLocation, limit: GAME_PLACES_LIMIT })
              )
          }
    const [mine, places] = await Promise.all([own.mine, own.places])

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    dropFromHydration(store, ...Object.values({ ...requests, ...own }).filter((request) => !!request))

    if (!game.data) {
        // Closed to this visitor (404), or the API is away: no page either way
        if (game.error && 'status' in game.error && game.error.status === 404) {
            return { notFound: true }
        }

        throw new Error(`Failed to load the game: ${JSON.stringify(game.error)}`)
    }

    return {
        props: {
            ...translations,
            game: game.data,
            leaders: leaders.data ?? null,
            mine: mine?.data ?? null,
            places: places?.data ?? null,
            placesNearby: !!visitorLocation,
            // The first quest with a cover (a riddle quest has none)
            questsCover: quests.data?.items.find(({ cover }) => !!cover)?.cover?.full ?? null,
            questsCount: quests.data?.count ?? 0
        }
    }
}
