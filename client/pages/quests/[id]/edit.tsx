import React from 'react'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { QuestForm } from '@/sections/game/quest-form'
import { questHref, QUESTS_HREF } from '@/utils/game'
import { dropFromHydration } from '@/utils/hydration'
import { hydrateAuthFromCookies, isAdminRequest } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

interface EditQuestPageProps {
    quest: ApiType.Game.QuestResponse
}

/**
 * The editor of a quest: every point with both languages of its texts, for the administrators.
 * The quest comes with the page; the query keeps it fresh, so a medal uploaded in the form shows at once.
 */
const EditQuestPage: NextPage<EditQuestPageProps> = (props) => {
    const { t } = useTranslation()

    const { data } = API.useQuestsGetItemQuery({ edit: true, id: props.quest.id })
    const quest = data ?? props.quest

    return (
        <AppLayout>
            <Head>{generateNextSeo({ nofollow: true, noindex: true, title: t('game-quest-form-edit') })}</Head>

            <PageHeader
                breadcrumbs={[
                    { link: QUESTS_HREF, text: t('game-quests-title') },
                    { link: questHref(quest.id, quest.slug), text: quest.title }
                ]}
                title={t('game-quest-form-edit')}
            />

            <QuestForm
                key={quest.id}
                quest={quest}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<EditQuestPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const translations = await loadPageTranslations()

            hydrateAuthFromCookies(store, context.req.cookies)
            store.dispatch(setLocale((context.locale ?? 'en') as ApiType.Locale))

            if (!id || !/^[0-9a-z]+$/i.test(id) || !(await isAdminRequest(store))) {
                return { notFound: true }
            }

            // The whole quest, with the points a walker has not opened: for the form only
            const request = store.dispatch(API.endpoints.questsGetItem.initiate({ edit: true, id }))
            const { data } = await request

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            dropFromHydration(store, request)

            if (!data) {
                return { notFound: true }
            }

            return { props: { ...translations, quest: data } }
        }
)

export default EditQuestPage
