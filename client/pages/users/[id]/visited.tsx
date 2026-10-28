import React, { useEffect, useState } from 'react'

import { GetServerSidePropsResult } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import {
    AppLayout,
    EmptyState,
    PageHeader,
    PaginationBar,
    PlacesList,
    PlacesMap,
    UserAvatar,
    VisitRow
} from '@/components/shared'
import { Chip } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { UserPagesEnum, UserTabs } from '@/sections/user'
import { getErrorMessage } from '@/utils/api'
import { encodeQueryData } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { loadPageTranslations } from '@/utils/translations.server'

import styles from './visited.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

export const VISITED_PLACES_PER_PAGE = 21
export const USER_VISITS_PER_PAGE = 20

/** `visits` — the timeline of check-ins (default), `places` — the distinct places */
type VisitedView = 'visits' | 'places'

interface UserVisitedPageProps {
    id: string
    currentPage: number
    view: VisitedView
    user?: ApiModel.User
}

const UserVisitedPage: React.FC<UserVisitedPageProps> = ({ id, user, currentPage, view }) => {
    const { t, i18n } = useTranslation()
    const dispatch = useAppDispatch()
    const router = useRouter()

    const isOwner = useAppSelector((state) => state.auth.user?.id === id)

    const [removeVisit] = API.useVisitsDeleteMutation()
    const [deleting, setDeleting] = useState<ApiModel.Visit>()

    const isPlaces = view === 'places'

    const { data, isLoading } = API.useVisitsGetPlacesQuery(
        {
            limit: VISITED_PLACES_PER_PAGE,
            offset: (currentPage - 1) * VISITED_PLACES_PER_PAGE,
            user: id
        },
        { skip: !isPlaces }
    )

    const { data: visitsData, isLoading: visitsLoading } = API.useVisitsGetListQuery(
        {
            limit: USER_VISITS_PER_PAGE,
            offset: (currentPage - 1) * USER_VISITS_PER_PAGE,
            user: id
        },
        { skip: isPlaces }
    )

    const { data: marksData, isLoading: marksLoading } = API.usePoiGetListQuery({ visited: id }, { skip: !isPlaces })

    // The last visit of a page after the first was deleted (or a page past the end in the address):
    // the page is gone, to the last one there is
    useEffect(() => {
        if (!isPlaces && currentPage > 1 && visitsData && !visitsData.items.length) {
            const { page: _page, ...query } = router.query
            const last = Math.max(1, Math.ceil((visitsData.count ?? 0) / USER_VISITS_PER_PAGE))

            void router.replace({
                pathname: router.pathname,
                query: last > 1 ? { ...query, page: last } : query
            })
        }
    }, [isPlaces, currentPage, visitsData, router])

    const handleDelete = async () => {
        const visit = deleting

        setDeleting(undefined)

        if (!visit?.place) {
            return
        }

        try {
            await removeVisit({ id: visit.id, place: visit.place.id }).unwrap()
        } catch (error) {
            void dispatch(
                Notify({ id: 'visitDelete', message: getErrorMessage(error) ?? '', title: '', type: 'error' })
            )
        }
    }

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pageTitle = currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''
    const title = t('user-visits-title')
    const linkPart = `users/${id}/visited`
    const pageQuery = (page: number) =>
        encodeQueryData({ page: page > 1 ? page : undefined, view: isPlaces ? 'places' : undefined })

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: `${user?.name} - ${title}${pageTitle}`,
                    description: `${user?.name} - ${title}${pageTitle}`,
                    canonical: `${canonicalUrl}${linkPart}${pageQuery(currentPage)}`,
                    noindex: true,
                    nofollow: false,
                    openGraph: {
                        description: `${user?.name} - ${title}${pageTitle}`,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: `${user?.name} - ${title}${pageTitle}`,
                        type: 'website',
                        url: `${canonicalUrl}users/${id}/visited`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(`users/${id}/visited`)
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
                currentPage={UserPagesEnum.VISITED}
            />

            <div className={styles.switch}>
                <Chip
                    label={t('visits-view-visits')}
                    selected={!isPlaces}
                    href={`/${linkPart}`}
                />
                <Chip
                    label={t('visits-view-places')}
                    selected={isPlaces}
                    href={`/${linkPart}?view=places`}
                />
            </div>

            {isPlaces ? (
                <>
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
                        perPage={VISITED_PLACES_PER_PAGE}
                        linkPart={linkPart}
                        urlParam={{ view: 'places' }}
                    />
                </>
            ) : (
                <>
                    {!!visitsData?.items.length && (
                        <ul className={styles.timeline}>
                            {visitsData.items.map((visit) => (
                                <VisitRow
                                    key={visit.id}
                                    visit={visit}
                                    onDelete={isOwner ? setDeleting : undefined}
                                />
                            ))}
                        </ul>
                    )}

                    {!visitsLoading && !visitsData?.items.length && <EmptyState title={t('visits-user-empty')} />}

                    <PaginationBar
                        currentPage={currentPage}
                        totalItemsCount={visitsData?.count ?? 0}
                        perPage={USER_VISITS_PER_PAGE}
                        linkPart={linkPart}
                    />
                </>
            )}

            {!!deleting && (
                <ConfirmationDialog
                    open={true}
                    message={t('visit-delete-confirmation')}
                    onCancel={() => setDeleting(undefined)}
                    onConfirm={() => void handleDelete()}
                />
            )}
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserVisitedPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const currentPage = parseInt(context.query.page as string, 10) || 1
            const view: VisitedView = context.query.view === 'places' ? 'places' : 'visits'
            const translations = await loadPageTranslations()

            if (typeof id !== 'string') {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            if (isError) {
                return { notFound: true }
            }

            if (view === 'places') {
                await store.dispatch(
                    API.endpoints.visitsGetPlaces.initiate({
                        limit: VISITED_PLACES_PER_PAGE,
                        offset: (currentPage - 1) * VISITED_PLACES_PER_PAGE,
                        user: id
                    })
                )
            } else {
                await store.dispatch(
                    API.endpoints.visitsGetList.initiate({
                        limit: USER_VISITS_PER_PAGE,
                        offset: (currentPage - 1) * USER_VISITS_PER_PAGE,
                        user: id
                    })
                )
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    id,
                    currentPage,
                    user: userData,
                    view
                }
            }
        }
)

export default UserVisitedPage
