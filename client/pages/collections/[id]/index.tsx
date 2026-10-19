import type { GetStaticPaths, GetStaticPropsResult } from 'next'

import { wrapper } from '@/app/store'
import { CollectionPage } from '@/sections/collections/collection-page'
import type { CollectionPageProps } from '@/sections/collections/collection-page/CollectionPage'
import { loadCollectionPage } from '@/sections/collections/collection-page/loadCollectionPage'

/** Seconds a cached collection is served before it is rendered anew in the background; a write
 *  on the collection renders it at once (the API calls /api/revalidate, server: SitePages) */
const PAGE_REVALIDATE = 24 * 60 * 60

/** A missing collection is asked again sooner: it may be an API blip */
const NOT_FOUND_REVALIDATE = 5 * 60

/** No page is built ahead: each one is rendered on its first visit, then served from the cache */
export const getStaticPaths: GetStaticPaths = async () => ({ fallback: 'blocking', paths: [] })

/**
 * A collection page of guests and crawlers, kept by Next until a write changes the collection.
 * A signed-in user gets `pages/live/collections/[id].tsx` instead (proxy.ts).
 */
export const getStaticProps = wrapper.getStaticProps(
    (store) =>
        async (context): Promise<GetStaticPropsResult<CollectionPageProps>> => {
            const result = await loadCollectionPage(store, { locale: context.locale, param: context.params?.id })

            if ('notFound' in result) {
                return { notFound: true, revalidate: NOT_FOUND_REVALIDATE }
            }

            return { ...result, revalidate: PAGE_REVALIDATE }
        }
)

export default CollectionPage
