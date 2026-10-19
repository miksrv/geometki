import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { UserPage } from '@/sections/user/user-page'
import { loadUserPage } from '@/sections/user/user-page/loadUserPage'
import type { UserPageProps } from '@/sections/user/user-page/UserPage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { getTimeZoneFromCookies } from '@/utils/timeZone'

/**
 * A user profile rendered on every request: a signed-in user's, or one with the calendar in
 * the visitor's time zone. proxy.ts rewrites `/users/{id}` here.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserPageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            return loadUserPage(store, {
                locale: context.locale,
                param: context.params?.id,
                timeZone: getTimeZoneFromCookies(context.req.cookies)
            })
        }
)

export default UserPage
