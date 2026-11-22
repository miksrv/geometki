import React from 'react'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { QuestForm } from '@/sections/game/quest-form'
import { QUESTS_HREF } from '@/utils/game'
import { hydrateAuthFromCookies, isAdminRequest } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

/** A new quest of the game: quests are made by hand, by the administrators */
const CreateQuestPage: NextPage = () => {
    const { t } = useTranslation()

    return (
        <AppLayout>
            <Head>{generateNextSeo({ nofollow: true, noindex: true, title: t('game-quest-form-new') })}</Head>

            <PageHeader
                breadcrumbs={[{ link: QUESTS_HREF, text: t('game-quests-title') }]}
                title={t('game-quest-form-new')}
            />

            <QuestForm />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const translations = await loadPageTranslations()

            hydrateAuthFromCookies(store, context.req.cookies)
            store.dispatch(setLocale((context.locale ?? 'en') as ApiType.Locale))

            // Not an administrator: there is no such page
            if (!(await isAdminRequest(store))) {
                return { notFound: true }
            }

            return { props: { ...translations } }
        }
)

export default CreateQuestPage
