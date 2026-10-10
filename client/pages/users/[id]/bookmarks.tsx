import React from 'react'

import { GetServerSidePropsResult } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader, PaginationBar, PlacesList, PlacesMap, UserAvatar } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { UserPagesEnum, UserTabs } from '@/sections/user'
import { buildHreflangTags } from '@/utils/seo'

export const PLACES_PER_PAGE = 21

interface UserBookmarksPageProps {
    id: string
    currentPage: number
    user?: ApiModel.User
}

const UserBookmarksPage: React.FC<UserBookmarksPageProps> = ({ id, user, currentPage }) => {
    const { t, i18n } = useTranslation()

    const { data, isLoading } = API.usePlacesGetListQuery({
        bookmarkUser: id,
        limit: PLACES_PER_PAGE,
        offset: (currentPage - 1) * PLACES_PER_PAGE
    })

    const { data: marksData, isLoading: marksLoading } = API.usePoiGetListQuery({ bookmarks: id })

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pageTitle = currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''
    const title = t('favorites')

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: `${user?.name} - ${title}${pageTitle}`,
                    description: `${user?.name} - ${t('all-traveler-geotags')}${pageTitle}`,
                    canonical: `${canonicalUrl}users/${id}/bookmarks${currentPage > 1 ? `?page=${currentPage}` : ''}`,
                    noindex: true,
                    nofollow: false,
                    openGraph: {
                        description: `${user?.name} - ${t('all-traveler-geotags')}${pageTitle}`,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: `${user?.name} - ${title}${pageTitle}`,
                        type: 'website',
                        url: `${canonicalUrl}users/${id}/bookmarks`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(`users/${id}/bookmarks`)
                })}
            </Head>

            <PageHeader
                title={`${title}${pageTitle}`}
                breadcrumbs={[
                    { link: '/users', text: t('users') },
                    { link: `/users/${id}`, text: user?.name || '' }
                ]}
                leading={
                    <UserAvatar
                        user={user}
                        size={'medium'}
                    />
                }
            />

            <UserTabs
                user={user}
                currentPage={UserPagesEnum.BOOKMARKS}
            />

            <PlacesMap
                places={marksData?.items}
                // The list comes from the server with the count: no placeholder for a user without places
                loading={marksLoading && !!data?.count}
            />

            <PlacesList
                places={data?.items}
                loading={isLoading}
            />

            <PaginationBar
                currentPage={currentPage}
                totalItemsCount={data?.count ?? 0}
                perPage={PLACES_PER_PAGE}
                linkPart={`users/${id}/bookmarks`}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserBookmarksPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const currentPage = parseInt(context.query.page as string, 10) || 1
            const translations = await serverSideTranslations(locale)

            if (typeof id !== 'string') {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            if (isError) {
                return { notFound: true }
            }

            await store.dispatch(
                API.endpoints.placesGetList.initiate({
                    bookmarkUser: id,
                    limit: PLACES_PER_PAGE,
                    offset: (currentPage - 1) * PLACES_PER_PAGE
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    id,
                    currentPage,
                    user: userData
                }
            }
        }
)

export default UserBookmarksPage
