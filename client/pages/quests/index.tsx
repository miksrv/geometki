import type { GetServerSidePropsResult } from 'next'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { QUEST_MODES, QUESTS_ACTIVE_LIMIT, QUESTS_PER_PAGE, QuestsPage } from '@/sections/game/quests-page'
import type { QuestsPageProps } from '@/sections/game/quests-page/QuestsPage'
import { dropFromHydration } from '@/utils/hydration'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'
import { getUserLocationFromCookies } from '@/utils/userLocation'

/**
 * All the quests of the game, a page at a time. Rendered on the request with the visitor's
 * token: their begun walks are a shelf of their own over the list, the list is the rest — the
 * nearest to them first when their point is known, with the distance; `?mode=` narrows the list.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<QuestsPageProps>> => {
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const currentPage = Math.max(1, parseInt(context.query.page as string, 10) || 1)
            const translations = await loadPageTranslations()

            hydrateAuthFromCookies(store, context.req.cookies)
            store.dispatch(setLocale(locale))

            const mode = QUEST_MODES.find((key) => key === context.query.mode) ?? null
            const location = getUserLocationFromCookies(context.req.cookies)
            const isAuth = !!store.getState().auth.isAuth

            const request = store.dispatch(
                API.endpoints.questsGetList.initiate({
                    ...location,
                    limit: QUESTS_PER_PAGE,
                    ...(mode ? { mode } : {}),
                    offset: (currentPage - 1) * QUESTS_PER_PAGE,
                    // The begun walks are the shelf: the list is the rest, the walked ones last
                    walk: 'idle'
                })
            )
            // The shelf of the begun walks: on every page and for every mode, the filter is the list's
            const activeRequest = isAuth
                ? store.dispatch(
                      API.endpoints.questsGetList.initiate({
                          ...location,
                          limit: QUESTS_ACTIVE_LIMIT,
                          walk: 'active'
                      })
                  )
                : undefined

            const [{ data, error }, activeResult] = await Promise.all([request, activeRequest])

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            dropFromHydration(store, request)

            if (activeRequest) {
                dropFromHydration(store, activeRequest)
            }

            if (!data) {
                if (error && 'status' in error && error.status === 404) {
                    return { notFound: true }
                }

                throw new Error(`Failed to load the quests: ${JSON.stringify(error)}`)
            }

            return {
                props: {
                    ...translations,
                    active: activeResult?.data?.items ?? [],
                    activeCount: activeResult?.data?.count ?? 0,
                    count: data.count,
                    currentPage,
                    mode,
                    quests: data.items
                }
            }
        }
)

export default QuestsPage
