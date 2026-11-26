import React from 'react'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { SeasonForm } from '@/sections/game/season-form'
import { GAME_HREF, seasonHref } from '@/utils/game'
import { hydrateAuthFromCookies, isAdminRequest } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

interface EditSeasonPageProps {
    season: ApiType.Game.SeasonAdmin
}

/**
 * The editor of a season, for the administrators: any season, with a page of its own or not (the
 * current and the next one are shown on the game page). The season comes with the page; the
 * query keeps it fresh, so a picture uploaded in the form shows at once.
 */
const EditSeasonPage: NextPage<EditSeasonPageProps> = (props) => {
    const { t, i18n } = useTranslation()

    const { data } = API.useGameGetSeasonManageQuery(props.season.id)
    const season = data ?? props.season
    const title = (i18n.language === 'en' && season.title_en) || season.title_ru

    return (
        <AppLayout>
            <Head>{generateNextSeo({ nofollow: true, noindex: true, title: t('game-season-edit') })}</Head>

            <PageHeader
                breadcrumbs={[
                    { link: GAME_HREF, text: t('game-title') },
                    ...(season.current ? [] : [{ link: seasonHref(season.id, season.slug), text: title }])
                ]}
                title={t('game-season-edit')}
            />

            {/* Keyed by the season: the form takes the texts once and keeps what is typed while the pictures reload */}
            <SeasonForm
                key={season.id}
                season={season}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<EditSeasonPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const translations = await loadPageTranslations()

            hydrateAuthFromCookies(store, context.req.cookies)
            store.dispatch(setLocale((context.locale ?? 'en') as ApiType.Locale))

            if (!id || !/^[0-9a-z]+$/i.test(id) || !(await isAdminRequest(store))) {
                return { notFound: true }
            }

            const { data } = await store.dispatch(API.endpoints.gameGetSeasonManage.initiate(id))

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            if (!data) {
                return { notFound: true }
            }

            return { props: { ...translations, season: data } }
        }
)

export default EditSeasonPage
