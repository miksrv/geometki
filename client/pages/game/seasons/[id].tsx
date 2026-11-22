import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { loadSeasonPage, SeasonPage } from '@/sections/game/season-page'
import type { SeasonPageProps } from '@/sections/game/season-page/SeasonPage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

/**
 * A past season of the game: its podium and the whole rating; a closed season's table is
 * frozen. The current season is the game page: its address here redirects to `/game`.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<SeasonPageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            return loadSeasonPage(store, { locale: context.locale, param: context.params?.id })
        }
)

export default SeasonPage
