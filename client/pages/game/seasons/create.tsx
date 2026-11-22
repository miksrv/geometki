import React from 'react'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { SeasonForm } from '@/sections/game/season-form'
import { GAME_HREF } from '@/utils/game'
import { hydrateAuthFromCookies, isAdminRequest } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

/** A new season of the game: seasons are made by hand, by the administrators, on the site like a quest */
const CreateSeasonPage: NextPage = () => {
    const { t } = useTranslation()

    return (
        <AppLayout>
            <Head>{generateNextSeo({ nofollow: true, noindex: true, title: t('game-season-form-new') })}</Head>

            <PageHeader
                breadcrumbs={[{ link: GAME_HREF, text: t('game-title') }]}
                title={t('game-season-form-new')}
            />

            <SeasonForm />
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

export default CreateSeasonPage
