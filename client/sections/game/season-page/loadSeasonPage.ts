import type { Redirect } from 'next'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { GAME_HREF, parseSeasonId, seasonHref } from '@/utils/game'
import { dropFromHydration } from '@/utils/hydration'
import { loadPageTranslations } from '@/utils/translations.server'

import { SEASON_LEADERS_LIMIT } from './constants'
import type { SeasonPageProps } from './SeasonPage'

interface LoadSeasonPageOptions {
    /** The route param: the bare id or `{id}-{slug}` */
    param?: string | string[]
    locale?: string
}

/**
 * The data of a past season's page. Server only; call after `hydrateAuthFromCookies` (the
 * visitor's own line of the table). The current season has no page of its own — it is the
 * game page, and its address redirects there (not for good: it becomes a past season). Any
 * other address than `{id}-{slug}` redirects to it for good, the slug follows the title. 404 for
 * a season nobody has met.
 */
export const loadSeasonPage = async (
    store: AppStore,
    { param, locale: contextLocale }: LoadSeasonPageOptions
): Promise<{ props: SeasonPageProps } | { notFound: true } | { redirect: Redirect }> => {
    const rawParam = typeof param === 'string' ? param : undefined
    const id = parseSeasonId(rawParam)
    const locale = (contextLocale ?? 'en') as ApiType.Locale
    const localePrefix = locale === 'en' ? '/en' : ''
    const translations = await loadPageTranslations()

    if (!rawParam || !id) {
        return { notFound: true }
    }

    store.dispatch(setLocale(locale))

    const requests = {
        leaders: store.dispatch(API.endpoints.gameGetLeaders.initiate({ limit: SEASON_LEADERS_LIMIT, season: id })),
        season: store.dispatch(API.endpoints.gameGetSeason.initiate(id))
    }

    const [season, leaders] = await Promise.all([requests.season, requests.leaders])

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    dropFromHydration(store, ...Object.values(requests))

    if (!season.data) {
        if (season.error && 'status' in season.error && season.error.status === 404) {
            return { notFound: true }
        }

        throw new Error(`Failed to load season ${id}: ${JSON.stringify(season.error)}`)
    }

    if (season.data.season.current) {
        return { redirect: { destination: `${localePrefix}${GAME_HREF}`, permanent: false } }
    }

    const canonical = seasonHref(id, season.data.season.slug)

    if (`/game/seasons/${rawParam}` !== canonical) {
        return { redirect: { destination: `${localePrefix}${canonical}`, statusCode: 301 } }
    }

    return { props: { ...translations, data: season.data, leaders: leaders.data ?? null } }
}
