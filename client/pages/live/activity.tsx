import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { ActivityPage } from '@/sections/activity/activity-page'
import type { ActivityPageProps } from '@/sections/activity/activity-page/ActivityPage'
import { loadActivityPage } from '@/sections/activity/activity-page/loadActivityPage'
import { isFeedFilter } from '@/utils/feed'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { getTimeZoneFromCookies } from '@/utils/timeZone'

/**
 * The activity feed rendered on every request: a signed-in user's, a filtered one (`?type=`)
 * or one in the visitor's time zone. proxy.ts rewrites `/activity` here.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<ActivityPageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            const { props } = await loadActivityPage(store, {
                filter: isFeedFilter(context.query.type) ? context.query.type : null,
                locale: context.locale,
                timeZone: getTimeZoneFromCookies(context.req.cookies)
            })

            return { props }
        }
)

export default ActivityPage
