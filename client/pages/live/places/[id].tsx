import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { PlacePage } from '@/sections/place/place-page'
import { loadPlacePage } from '@/sections/place/place-page/loadPlacePage'
import type { PlacePageProps } from '@/sections/place/place-page/PlacePage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { getUserLocationFromCookies } from '@/utils/userLocation'

/**
 * The place page of a signed-in user, rendered on every request with their token: their
 * score, bookmarks and "I've been here" marks are in the HTML, and they never see a cached
 * copy. Not a URL of its own: proxy.ts rewrites `/places/{id}` here when the auth cookie is
 * set (see CACHED_PAGES there), and 301s `/live/...` itself to the page.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<PlacePageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            return loadPlacePage(store, {
                locale: context.locale,
                param: context.params?.id,
                visitorLocation: getUserLocationFromCookies(context.req.cookies)
            })
        }
)

export default PlacePage
