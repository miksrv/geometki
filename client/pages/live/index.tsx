import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { HomePage } from '@/sections/home/home-page'
import type { HomePageProps } from '@/sections/home/home-page/HomePage'
import { loadHomePage } from '@/sections/home/home-page/loadHomePage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { getUserLocationFromCookies } from '@/utils/userLocation'

/**
 * The home page rendered on every request: a signed-in user's (the welcome panel, their feed)
 * or a guest's with their point (distances on the cards). proxy.ts rewrites `/` here.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<HomePageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            const { props } = await loadHomePage(store, {
                locale: context.locale,
                visitorLocation: getUserLocationFromCookies(context.req.cookies)
            })

            return { props }
        }
)

export default HomePage
