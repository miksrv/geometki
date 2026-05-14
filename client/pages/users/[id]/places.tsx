import React from 'react'
import { cn, Container, Spinner } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header, PlacesList } from '@/components/shared'
import { Pagination } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { UserPagesEnum, UserTabs } from '@/sections/user'
import { buildHreflangTags } from '@/utils/seo'

import styles from '@/sections/user/styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap').then((m) => m.InteractiveMap), {
    ssr: false
})

export const PLACES_PER_PAGE = 21

interface UserPlacesPageProps {
    id: string
    currentPage: number
    user?: ApiModel.User
}

const UserPlacesPage: React.FC<UserPlacesPageProps> = ({ id, user, currentPage }) => {
    const { t, i18n } = useTranslation()

    const { data, isLoading } = API.usePlacesGetListQuery({
        author: id,
        limit: PLACES_PER_PAGE,
        offset: (currentPage - 1) * PLACES_PER_PAGE
    })

    const { data: marksData } = API.usePoiGetListQuery({ author: id })

    const placeMarks: ApiModel.PlaceMark[] = marksData?.items ?? []

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pageTitle = currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''
    const title = t('geotags')

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: `${user?.name} - ${title}${pageTitle}`,
                    description: `${user?.name} - ${t('all-traveler-geotags')}${pageTitle}`,
                    canonical: `${canonicalUrl}users/${id}/places${currentPage > 1 ? `?page=${currentPage}` : ''}`,
                    openGraph: {
                        description: `${user?.name} - ${t('all-traveler-geotags')}${pageTitle}`,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: `${user?.name} - ${title}${pageTitle}`,
                        type: 'website',
                        url: `${canonicalUrl}users/${id}/places`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(`users/${id}/places`)
                })}
            </Head>

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

            {!!placeMarks.length && (
                <Container style={{ height: '350px', padding: '2px' }}>
                    <InteractiveMap
                        places={placeMarks}
                        enableCenterPopup={false}
                        enableContextMenu={false}
                        enableFullScreen={false}
                        enableCoordsControl={false}
                        enableCategoryControl={false}
                        enableLayersSwitcher={false}
                        storeMapPosition={false}
                        controlsSize={'small'}
                    />
                </Container>
            )}

            <UserTabs
                user={user}
                currentPage={UserPagesEnum.PLACES}
            />

            <PlacesList
                places={data?.items}
                loading={isLoading}
            />

            <Container
                className={cn('paginationContainer', !data?.count || data?.count <= PLACES_PER_PAGE ? 'hide' : '')}
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
                    linkPart={`users/${id}/places`}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserPlacesPageProps>> => {
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
                    author: id,
                    limit: PLACES_PER_PAGE,
                    offset: (currentPage - 1) * PLACES_PER_PAGE
                })
            )

            await store.dispatch(API.endpoints.poiGetList.initiate({ author: id }))

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

export default UserPlacesPage
