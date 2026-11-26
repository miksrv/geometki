import { GetServerSidePropsResult } from 'next'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { hydrateAuthFromCookies, isAdminRequest } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

export interface AdminPageProps {
    locale: ApiType.Locale
}

/**
 * `getServerSideProps` of every admin page: translations and the locale, the visitor's auth
 * from the cookies, and a 404 for anyone but an administrator. The pages re-export it:
 * `export const getServerSideProps = getAdminServerSideProps`.
 */
export const getAdminServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<AdminPageProps>> => {
            const locale = (context.locale ?? 'ru') as ApiType.Locale
            const translations = await loadPageTranslations()

            store.dispatch(setLocale(locale))
            hydrateAuthFromCookies(store, context.req.cookies)

            if (!(await isAdminRequest(store))) {
                return { notFound: true }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return { props: { ...translations, locale } }
        }
)
