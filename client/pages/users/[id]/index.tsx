import type { GetStaticPaths, GetStaticPropsResult } from 'next'

import { wrapper } from '@/app/store'
import { UserPage } from '@/sections/user/user-page'
import { loadUserPage } from '@/sections/user/user-page/loadUserPage'
import type { UserPageProps } from '@/sections/user/user-page/UserPage'

/** Seconds a cached profile is served before it is rendered anew in the background: the
 *  feed, the counters and the calendar move with the user's actions */
const PAGE_REVALIDATE = 10 * 60

/** No page is built ahead: each one is rendered on its first visit, then served from the cache */
export const getStaticPaths: GetStaticPaths = async () => ({ fallback: 'blocking', paths: [] })

/**
 * A user profile of guests and crawlers, in the site's days. A signed-in user or a visitor in
 * another time zone gets `pages/live/users/[id].tsx` instead (proxy.ts).
 */
export const getStaticProps = wrapper.getStaticProps(
    (store) =>
        async (context): Promise<GetStaticPropsResult<UserPageProps>> => {
            const result = await loadUserPage(store, { locale: context.locale, param: context.params?.id })

            return 'notFound' in result
                ? { notFound: true, revalidate: PAGE_REVALIDATE }
                : { ...result, revalidate: PAGE_REVALIDATE }
        }
)

export default UserPage
