import React, { useCallback, useMemo } from 'react'
import { Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header, UsersList } from '@/components/shared'
import { Pagination } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { UsersFilterPanel, UsersFilterType } from '@/sections/user'
import { encodeQueryData } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const USERS_PER_PAGE = 30
const DEFAULT_SORT = 'activity_at'
const DEFAULT_ORDER = 'DESC'

interface UsersPageProps {
    usersList: ApiModel.User[]
    usersCount: number
    currentPage: number
    search: string | null
    sort: string
    order: string
}

const UsersPage: NextPage<UsersPageProps> = ({ usersList, usersCount, currentPage, search, sort, order }) => {
    const { t, i18n } = useTranslation()

    const router = useRouter()

    const initialFilter: UsersFilterType = {
        order: order !== DEFAULT_ORDER ? order : undefined,
        page: currentPage !== 1 ? currentPage : undefined,
        search: search ?? undefined,
        sort: sort !== DEFAULT_SORT ? sort : undefined
    }

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const title = useMemo(
        () => t('users') + (currentPage && currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''),
        [currentPage, i18n.language]
    )

    const handleChangeFilter = useCallback(
        async (key: keyof UsersFilterType, value: string | undefined) => {
            const filter = { ...initialFilter, [key]: value }
            if (key !== 'page') {
                filter.page = undefined
            }
            return await router.push('/users' + encodeQueryData(filter))
        },
        [initialFilter, router]
    )

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: title,
                    description: `${title} - ${usersList
                        ?.map(({ name }) => name)
                        ?.join(', ')
                        ?.substring(0, 220)}`,
                    canonical: `${canonicalUrl}users${currentPage && currentPage > 1 ? '?page=' + currentPage : ''}`,
                    openGraph: {
                        description: `${title} - ${usersList
                            ?.map(({ name }) => name)
                            ?.join(', ')
                            ?.substring(0, 220)}`,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title,
                        type: 'website',
                        url: `${canonicalUrl}users`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('users')
                })}
            </Head>

            <Header
                title={title}
                homePageTitle={t('geotags')}
                currentPage={t('users')}
            />

            <Container style={{ padding: '10px' }}>
                <UsersFilterPanel
                    search={search ?? undefined}
                    sort={sort}
                    order={order}
                    onChange={handleChangeFilter}
                />
            </Container>

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
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const currentPage = parseInt(context.query.page as string, 10) || 1
            const search = (context.query.search as string) || null
            const sort = (context.query.sort as string) || DEFAULT_SORT
            const order = (context.query.order as string) || DEFAULT_ORDER
            const translations = await serverSideTranslations(locale)

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const { data: usersList } = await store.dispatch(
                API.endpoints.usersGetList.initiate({
                    limit: USERS_PER_PAGE,
                    offset: (currentPage - 1) * USERS_PER_PAGE,
                    order: order as 'ASC' | 'DESC',
                    search: search ?? undefined,
                    sort: sort as ApiType.Users.UserSortFields
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    currentPage,
                    order,
                    search,
                    sort,
                    usersCount: usersList?.count ?? 0,
                    usersList: usersList?.items ?? []
                }
            }
        }
)

export default UsersPage
