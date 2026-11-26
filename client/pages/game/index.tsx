import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { GamePage, loadGamePage } from '@/sections/game/game-page'
import type { GamePageProps } from '@/sections/game/game-page/GamePage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { getUserLocationFromCookies } from '@/utils/userLocation'

/**
 * The section "Game": rendered on every request, with the visitor's token — their score, their
 * walks and the places they have not confirmed are all theirs.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<GamePageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            return loadGamePage(store, {
                locale: context.locale,
                visitorLocation: getUserLocationFromCookies(context.req.cookies)
            })
        }
)

export default GamePage
