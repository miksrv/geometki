import type { GetServerSidePropsResult } from 'next'

import { wrapper } from '@/app/store'
import { loadQuestPage, QuestPage } from '@/sections/game/quest-page'
import type { QuestPageProps } from '@/sections/game/quest-page/QuestPage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

/**
 * A quest of the game, rendered on every request with the visitor's token: the points they
 * have opened are theirs alone — the next step or the answer of a riddle is never in the page.
 */
export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<QuestPageProps>> => {
            hydrateAuthFromCookies(store, context.req.cookies)

            return loadQuestPage(store, { locale: context.locale, param: context.params?.id })
        }
)

export default QuestPage
