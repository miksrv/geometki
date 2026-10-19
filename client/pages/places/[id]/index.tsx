import type { GetStaticPaths, GetStaticPropsResult } from 'next'

import { wrapper } from '@/app/store'
import { PlacePage } from '@/sections/place/place-page'
import { loadPlacePage } from '@/sections/place/place-page/loadPlacePage'
import type { PlacePageProps } from '@/sections/place/place-page/PlacePage'

/** Seconds a rendered page is served before it is rendered anew in the background: a safety
 *  net for what no write announces (a new place nearby, the author's new name). A write on the
 *  place itself renders it at once: the API calls /api/revalidate (server: SitePages) */
const PAGE_REVALIDATE = 24 * 60 * 60

/** A missing place is asked again sooner: it may be an API blip, not a deleted place */
const NOT_FOUND_REVALIDATE = 5 * 60

/** No page is built ahead: each one is rendered on its first visit, then served from the cache */
export const getStaticPaths: GetStaticPaths = async () => ({ fallback: 'blocking', paths: [] })

/**
 * The place page of guests and crawlers: the same for all of them, rendered once without
 * cookies and kept by Next until a write changes the place (on-demand ISR). A signed-in user
 * gets `live.tsx` instead (proxy.ts). Everything about the visitor — the distance, the own
 * score, the bookmark — comes in the browser.
 */
export const getStaticProps = wrapper.getStaticProps(
    (store) =>
        async (context): Promise<GetStaticPropsResult<PlacePageProps>> => {
            const result = await loadPlacePage(store, { locale: context.locale, param: context.params?.id })

            if ('notFound' in result) {
                return { notFound: true, revalidate: NOT_FOUND_REVALIDATE }
            }

            return { ...result, revalidate: PAGE_REVALIDATE }
        }
)

export default PlacePage
