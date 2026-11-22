import type { GetServerSidePropsResult } from 'next'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { HelpPage } from '@/sections/game/help-page'
import type { HelpPageProps } from '@/sections/game/help-page/HelpPage'
import { loadContentPage } from '@/utils/content.server'
import { dropFromHydration } from '@/utils/hydration'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

/**
 * "Как играть": the text of the page is a Markdown file (`client/content/game-help.<locale>.md`),
 * the numbers of its table come from the API (`GET /game` → `rules`), rendered on the request.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<HelpPageProps>> => {
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await loadPageTranslations()

            hydrateAuthFromCookies(store, context.req.cookies)
            store.dispatch(setLocale(locale))

            const request = store.dispatch(API.endpoints.gameGet.initiate())
            const { data, error } = await request

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            dropFromHydration(store, request)

            if (!data && error && 'status' in error && error.status === 404) {
                return { notFound: true }
            }

            const { html, headings } = loadContentPage('game-help', locale)

            // The text stands on its own: an API failure leaves only the table of points out
            return { props: { ...translations, content: html, headings, rules: data?.rules ?? null } }
        }
)

export default HelpPage
