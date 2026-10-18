import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { CollectionPage } from '@/sections/collections/collection-page'
import type { CollectionPageProps } from '@/sections/collections/collection-page/CollectionPage'
import { loadCollectionPage } from '@/sections/collections/collection-page/loadCollectionPage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

/**
 * A collection page rendered on every request with the signed-in user's token: fresh, and
 * their own hidden collection is shown to them. proxy.ts rewrites `/collections/{id}` here.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<CollectionPageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            return loadCollectionPage(store, {
                locale: context.locale,
                param: context.params?.id,
                query: context.query
            })
        }
)

export default CollectionPage
