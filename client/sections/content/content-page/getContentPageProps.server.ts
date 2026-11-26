import type { GetServerSideProps } from 'next'

import { ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { loadContentPage } from '@/utils/content.server'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

import type { ContentPageProps } from './ContentPage'

/**
 * The data function of a static page (`ContentPage`): its Markdown file of the locale — title,
 * description, text and sections —, rendered on the request with the visitor's token (the app
 * bar). `page` is the file's name and the page's path. Server only: import it from `pages/`.
 */
export const getContentPageProps = (
    page: Parameters<typeof loadContentPage>[0]
): GetServerSideProps<ContentPageProps> =>
    wrapper.getServerSideProps((store) => async (context) => {
        const locale = (context.locale ?? 'en') as ApiType.Locale
        const translations = await loadPageTranslations()

        hydrateAuthFromCookies(store, context.req.cookies)
        store.dispatch(setLocale(locale))

        const { html, headings, title, description } = loadContentPage(page, locale)

        return { props: { ...translations, content: html, description, headings, path: page, title } }
    })
