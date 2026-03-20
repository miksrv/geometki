import React from 'react'
import { Container, Spinner } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiModel, ApiType } from '@/api'
import { SITE_LINK } from '@/config/env'
import { setLocale } from '@/api/applicationSlice'
import { wrapper } from '@/api/store'
import { AppLayout, Header, PlacesList } from '@/components/common'
import { UserPagesEnum, UserTabs } from '@/components/pages/user'
import { Pagination } from '@/components/ui'

import styles from '@/components/pages/user/styles.module.sass'

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

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pageTitle = currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''
    const title = t('favorites')

    return (
        <AppLayout>
            <NextSeo
                title={`${user?.name} - ${title}${pageTitle}`}
                description={`${user?.name} - ${t('all-traveler-geotags')}${pageTitle}`}
                canonical={`${canonicalUrl}users/${id}/bookmarks`}
            />

            <Header
                title={`${user?.name} - ${title}${pageTitle}`}
                homePageTitle={t('geotags')}
                currentPage={title}
                backLink={`/users/${id}`}
                userData={user}
                links={[
                    {
                        link: '/users/',
                        text: t('users')
                    },
                    {
                        link: `/users/${id}`,
                        text: user?.name || ''
                    }
                ]}
            />

            <UserTabs
                user={user}
                currentPage={UserPagesEnum.BOOKMARKS}
            />

            <PlacesList
                places={data?.items}
                loading={isLoading}
            />

            <Container
                style={{ marginTop: 15 }}
                className={`paginationContainer ${!data?.count || data?.count <= PLACES_PER_PAGE ? 'hide' : ''}`}
            >
                <div className={styles.countContainer}>
                    {t('geotags')}: {isLoading ? <Spinner /> : <strong>{data?.count || 0}</strong>}
                </div>

                <Pagination
                    currentPage={currentPage}
                    captionPage={t('page')}
                    captionNextPage={t('next-page')}
                    captionPrevPage={t('prev-page')}
                    totalItemsCount={data?.count ?? 0}
                    perPage={PLACES_PER_PAGE}
                    linkPart={`users/${id}/bookmarks`}
                />
            </Container>
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
