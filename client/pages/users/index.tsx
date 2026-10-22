import React, { useCallback, useMemo } from 'react'

import type { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { UserSortFields } from '@/api/types/users'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { USERS_DEFAULT_SORT, UsersFilterPanel, UsersFilterType, UsersListing } from '@/sections/user'
import { encodeQueryData } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

const USERS_PER_PAGE = 30
const DEFAULT_ORDER = 'DESC'

/** Sorts that make the list a ranking: the cards are numbered */
const RANKED_SORTS: string[] = [UserSortFields.Experience, UserSortFields.Reputation]

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
        sort: sort !== USERS_DEFAULT_SORT ? sort : undefined
    }

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const canonicalQuery = currentPage > 1 ? `?page=${currentPage}` : ''

    const title = useMemo(
        () => t('users') + (currentPage && currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''),
        [currentPage, i18n.language]
    )

    const request: ApiType.Users.ListRequest = {
        order: order as 'ASC' | 'DESC',
        places: 1,
        search: search ?? undefined,
        sort: sort as ApiType.Users.UserSortFields
    }

    const handleChangeSearch = useCallback(
        (value: string | undefined) =>
            router.push('/users' + encodeQueryData({ ...initialFilter, page: undefined, search: value }), undefined, {
                scroll: false
            }),
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
                    canonical: `${canonicalUrl}users${canonicalQuery}`,
                    noindex: true,
                    nofollow: false,
                    openGraph: {
                        description: `${title} - ${usersList
                            ?.map(({ name }) => name)
                            ?.join(', ')
                            ?.substring(0, 220)}`,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title,
                        type: 'website',
                        url: `${canonicalUrl}users${canonicalQuery}`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('users', canonicalQuery)
                })}
            </Head>

            <PageHeader
                title={title}
                count={t('users-count', '{{count}} человек', { count: usersCount })}
                lede={
                    currentPage === 1 && !search
                        ? t(
                              'users-lede',
                              'Те, кто находит интересные места, фотографирует их и пишет о них. Каждое место, фото и отзыв приносят опыт — так растёт уровень. Загляните в профиль, чтобы увидеть всё, что человек открыл.'
                          )
                        : undefined
                }
            />

            <UsersFilterPanel
                search={search ?? undefined}
                sort={sort}
                onChangeSearch={handleChangeSearch}
            />

            <UsersListing
                key={`${sort}-${order}-${search}-${currentPage}`}
                users={usersList}
                count={usersCount}
                currentPage={currentPage}
                perPage={USERS_PER_PAGE}
                request={request}
                ranked={!search && order === DEFAULT_ORDER && RANKED_SORTS.includes(sort)}
                urlParam={initialFilter}
            />
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
            const sortQuery = context.query.sort as string
            const sort = (Object.values(UserSortFields) as string[]).includes(sortQuery)
                ? sortQuery
                : USERS_DEFAULT_SORT
            const order = context.query.order === 'ASC' ? 'ASC' : DEFAULT_ORDER
            const translations = await loadPageTranslations()

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const { data: usersList } = await store.dispatch(
                API.endpoints.usersGetList.initiate({
                    limit: USERS_PER_PAGE,
                    offset: (currentPage - 1) * USERS_PER_PAGE,
                    order: order as 'ASC' | 'DESC',
                    places: 1,
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
