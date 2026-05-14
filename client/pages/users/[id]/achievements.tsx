import React from 'react'
import { Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AchievementsList } from '@/components/pages/achievements-list'
import { AppLayout } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { UserHeader, UserPagesEnum, UserTabs } from '@/sections/user'
import { buildHreflangTags } from '@/utils/seo'

interface UserAchievementsPageProps {
    id: string
    user?: ApiModel.User
    locale: ApiType.Locale
}

const UserAchievementsPage: React.FC<UserAchievementsPageProps> = ({ id, user }) => {
    const { t, i18n } = useTranslation()

    const { data, isLoading } = API.useGetUserAchievementsQuery(id)
    const achievements = data?.data ?? []

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pageTitle = `${user?.name} - ${t('achievements-title')}`

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: pageTitle,
                    description: pageTitle,
                    canonical: `${canonicalUrl}users/${id}/achievements`,
                    openGraph: {
                        description: pageTitle,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: pageTitle,
                        type: 'website',
                        url: `${canonicalUrl}users/${id}/achievements`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(`users/${id}/achievements`)
                })}
            </Head>

            <UserHeader user={user} />

            <UserTabs
                user={user}
                currentPage={UserPagesEnum.ACHIEVEMENTS}
            />

            <Container>
                <AchievementsList
                    achievements={achievements}
                    isLoading={isLoading}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserAchievementsPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'ru') as ApiType.Locale

            if (!id) {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            if (isError) {
                return { notFound: true }
            }

            await store.dispatch(API.endpoints.getUserAchievements.initiate(id))
            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            const translations = await serverSideTranslations(locale)

            return {
                props: {
                    ...translations,
                    id,
                    locale,
                    user: userData
                }
            }
        }
)

export default UserAchievementsPage
