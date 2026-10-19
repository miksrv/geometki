import type { GetStaticPropsResult } from 'next'

import { wrapper } from '@/app/store'
import { ActivityPage } from '@/sections/activity/activity-page'
import type { ActivityPageProps } from '@/sections/activity/activity-page/ActivityPage'
import { loadActivityPage } from '@/sections/activity/activity-page/loadActivityPage'
import { staticRevalidate } from '@/utils/staticPage'

/** Seconds the cached feed is served before it is rendered anew in the background */
const PAGE_REVALIDATE = 2 * 60

/**
 * The whole activity feed of guests and crawlers, in the site's days, kept by Next for a couple
 * of minutes. A signed-in user, a filter (`?type=`) or a visitor in another time zone gets
 * `pages/live/activity.tsx` instead (proxy.ts).
 */
export const getStaticProps = wrapper.getStaticProps(
    (store) =>
        async (context): Promise<GetStaticPropsResult<ActivityPageProps>> => {
            const { failed, props } = await loadActivityPage(store, { locale: context.locale })

            return { props, revalidate: staticRevalidate(failed, PAGE_REVALIDATE) }
        }
)

export default ActivityPage
