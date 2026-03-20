import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiModel, ApiType } from '@/api'
import { SITE_LINK } from '@/config/env'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header, PhotoGallery } from '@/components/shared'
import { UserPagesEnum, UserTabs } from '@/sections/user'
import { Pagination } from '@/components/ui'

export const PHOTOS_PER_PAGE = 32

interface UserPhotosPageProps {
    id: string
    currentPage: number
    user?: ApiModel.User
    photosList?: ApiModel.Photo[]
    photosCount: number
}

const UserPhotosPage: React.FC<UserPhotosPageProps> = ({ id, user, photosList, photosCount, currentPage }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pageTitle = currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''

    return (
        <AppLayout>
            <NextSeo
                title={`${user?.name} - ${t('photos')}${pageTitle}`}
                description={`${user?.name} - ${t('all-traveler-photos')}${pageTitle}`}
                canonical={`${canonicalUrl}users/${id}/photos`}
            />

            <Header
                title={`${user?.name} - ${t('photos')}${pageTitle}`}
                homePageTitle={t('geotags')}
                currentPage={t('photos')}
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
                currentPage={UserPagesEnum.PHOTOS}
            />

            <PhotoGallery photos={photosList} />

            <Container className={'paginationContainer'}>
                <div>
                    {t('photos')}: <strong>{photosCount ?? 0}</strong>
                </div>

                <Pagination
                    currentPage={currentPage}
                    captionPage={t('page')}
                    captionNextPage={t('next-page')}
                    captionPrevPage={t('prev-page')}
                    totalItemsCount={photosCount}
                    perPage={PHOTOS_PER_PAGE}
                    linkPart={`users/${id}/photos`}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserPhotosPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const currentPage = parseInt(context.query.page as string, 10) || 1
            const translations = await serverSideTranslations(locale)

            if (typeof id !== 'string') {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            const { data: photosData } = await store.dispatch(
                API.endpoints.photosGetList.initiate({
                    author: id,
                    limit: PHOTOS_PER_PAGE,
                    offset: (currentPage - 1) * PHOTOS_PER_PAGE
                })
            )

            if (isError) {
                return { notFound: true }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    id,
                    currentPage,
                    photosCount: photosData?.count ?? 0,
                    photosList: photosData?.items ?? [],
                    user: userData
                }
            }
        }
)

export default UserPhotosPage
