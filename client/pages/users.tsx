import React, { useMemo } from 'react'
import { Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiModel, ApiType } from '@/api'
import { SITE_LINK } from '@/config/env'
import { setLocale } from '@/api/applicationSlice'
import { wrapper } from '@/api/store'
import { AppLayout, Header, UsersList } from '@/components/shared'
import { Pagination } from '@/components/ui'

const USERS_PER_PAGE = 30

interface UsersPageProps {
    usersList: ApiModel.User[]
    usersCount: number
    currentPage: number
}

const UsersPage: NextPage<UsersPageProps> = ({ usersList, usersCount, currentPage }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const title = useMemo(
        () => t('users') + (currentPage && currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''),
        [currentPage, i18n.language]
    )

    return (
        <AppLayout>
            <NextSeo
                title={title}
                description={`${title} - ${usersList
                    ?.map(({ name }) => name)
                    ?.join(', ')
                    ?.substring(0, 220)}`}
                canonical={`${canonicalUrl}users${currentPage && currentPage > 1 ? '?page=' + currentPage : ''}`}
            />

            <Header
                title={title}
                homePageTitle={t('geotags')}
                currentPage={t('users')}
            />

            <UsersList users={usersList} />

            <Container className={'paginationContainer'}>
                <div>
                    {t('users_count')}: <strong>{usersCount}</strong>
                </div>
                <Pagination
                    currentPage={currentPage}
                    captionPage={t('page')}
                    captionNextPage={t('next-page')}
                    captionPrevPage={t('prev-page')}
                    totalItemsCount={usersCount}
                    perPage={USERS_PER_PAGE}
                    linkPart={'users'}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UsersPageProps>> => {
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const currentPage = parseInt(context.query.page as string, 10) || 1
            const translations = await serverSideTranslations(locale)

            store.dispatch(setLocale(locale))

            const { data: usersList } = await store.dispatch(
                API.endpoints.usersGetList.initiate({
                    limit: USERS_PER_PAGE,
                    offset: (currentPage - 1) * USERS_PER_PAGE
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    currentPage,
                    usersCount: usersList?.count ?? 0,
                    usersList: usersList?.items ?? []
                }
            }
        }
)

export default UsersPage
