import React from 'react'

import { GetServerSidePropsResult } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { UserHero, UserReputation } from '@/sections/user'
import { buildHreflangTags } from '@/utils/seo'
import { loadPageTranslations } from '@/utils/translations.server'

interface UserReputationPageProps {
    id: string
    user?: ApiModel.User
}

/** The history of a reputation: a sub-page of the profile, the card's "репутация" leads here */
const UserReputationPage: React.FC<UserReputationPageProps> = ({ id, user }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const title = `${user?.name} - ${t('reputation-history-title')}`

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title,
                    description: title,
                    canonical: `${canonicalUrl}users/${id}/reputation`,
                    noindex: true,
                    nofollow: false,
                    openGraph: {
                        description: title,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title,
                        type: 'website',
                        url: `${canonicalUrl}users/${id}/reputation`
                    },
                    additionalLinkTags: buildHreflangTags(`users/${id}/reputation`)
                })}
            </Head>

            <UserHero
                user={user}
                currentPage={'overview'}
            />

            <UserReputation userId={id} />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserReputationPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await loadPageTranslations()

            if (typeof id !== 'string') {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            if (isError) {
                return { notFound: true }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    id,
                    user: userData
                }
            }
        }
)

export default UserReputationPage
