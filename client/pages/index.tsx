import type { GetStaticPropsResult } from 'next'

import { wrapper } from '@/app/store'
import { HomePage } from '@/sections/home/home-page'
import type { HomePageProps } from '@/sections/home/home-page/HomePage'
import { loadHomePage } from '@/sections/home/home-page/loadHomePage'
import { staticRevalidate } from '@/utils/staticPage'

/** Seconds the cached home page is served before it is rendered anew in the background: the
 *  feed, the active travelers and the counters move by the minute, not by the second */
const PAGE_REVALIDATE = 5 * 60

/**
 * The home page of guests and crawlers: the same for all of them, kept by Next for a few
 * minutes. A signed-in user, or a guest with their point (distances on the cards), gets
 * `pages/live/index.tsx` instead (proxy.ts).
 */
export const getStaticProps = wrapper.getStaticProps(
    (store) =>
        async (context): Promise<GetStaticPropsResult<HomePageProps>> => {
            const { failed, props } = await loadHomePage(store, { locale: context.locale })

            return { props, revalidate: staticRevalidate(failed, PAGE_REVALIDATE) }
        }
)

export default HomePage
