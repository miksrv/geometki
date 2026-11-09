import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { AppStore, useAppSelector, wrapper } from '@/app/store'
import { AppLayout, EmptyState, PaginationBar, PlacesList } from '@/components/shared'
import { Chip } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { UserHero } from '@/sections/user'
import { encodeQueryData } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { loadPageTranslations } from '@/utils/translations.server'
import { getUserLocationFromCookies } from '@/utils/userLocation'

import styles from './places.module.sass'

export const PLACES_PER_PAGE = 21

/**
 * The sets of the "Места" tab: `added` — the places the person added (default), `visited` —
 * the places they have been to at least once, `bookmarks` — their bookmarks. The person's map
 * is on the overview, the tab is the lists.
 */
export type UserPlacesShow = 'added' | 'visited' | 'bookmarks'

const SHOWS: UserPlacesShow[] = ['added', 'visited', 'bookmarks']

/** `visits` of old links (the timeline of check-ins, gone in 1.19.1) is the visited places */
export const parseUserPlacesShow = (value: unknown): UserPlacesShow =>
    value === 'visits' ? 'visited' : SHOWS.includes(value as UserPlacesShow) ? (value as UserPlacesShow) : 'added'

/** The places request of a set; the visited places have their own */
const placesRequest = (
    id: string,
    show: UserPlacesShow,
    page: number,
    location: ApiType.Coordinates | null
): ApiType.Places.ListRequest => ({
    author: show === 'added' ? id : undefined,
    bookmarkUser: show === 'bookmarks' ? id : undefined,
    lat: location?.lat,
    limit: PLACES_PER_PAGE,
    lon: location?.lon,
    offset: (page - 1) * PLACES_PER_PAGE
})

const visitedRequest = (id: string, page: number) => ({
    limit: PLACES_PER_PAGE,
    offset: (page - 1) * PLACES_PER_PAGE,
    user: id
})

interface UserPlacesPageProps {
    id: string
    currentPage: number
    show: UserPlacesShow
    user?: ApiModel.User
    /** The visitor's location from the cookie, so the client query reuses the SSR one */
    userLocation: ApiType.Coordinates | null
}

const UserPlacesPage: React.FC<UserPlacesPageProps> = ({ id, user, currentPage, show, userLocation }) => {
    const { t, i18n } = useTranslation()

    const isOwner = useAppSelector((state) => state.auth.user?.id === id)

    const places = API.usePlacesGetListQuery(placesRequest(id, show, currentPage, userLocation), {
        skip: show === 'visited'
    })
    const visited = API.useVisitsGetPlacesQuery(visitedRequest(id, currentPage), { skip: show !== 'visited' })

    const counts: Record<UserPlacesShow, number | undefined> = {
        added: user?.statistic?.place ?? 0,
        bookmarks: user?.statistic?.bookmarks ?? 0,
        visited: user?.statistic?.visited ?? 0
    }

    const linkPart = `users/${id}/places`
    const showParam = show === 'added' ? undefined : show
    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const pageTitle = currentPage > 1 ? ` - ${t('page')} ${currentPage}` : ''
    const title = `${t('user-tab-places')}: ${t(`user-places-${show}`)}`
    const listData = show === 'visited' ? visited : places

    // One empty state for every set: the owner is told what to do, anyone else what to expect
    const emptyKey = `user-places-empty-${show}-${isOwner ? 'own' : 'other'}`
    const emptyAction =
        isOwner &&
        (show === 'added' ? (
            <Button
                size={'medium'}
                mode={'primary'}
                icon={'PlusCircle'}
                label={t('user-places-empty-add')}
                link={'/places/create'}
            />
        ) : (
            <Button
                size={'medium'}
                mode={'secondary'}
                icon={'Search'}
                label={t('user-places-empty-find')}
                link={'/places'}
            />
        ))
    const empty = (
        <EmptyState
            title={t(`${emptyKey}-title`)}
            description={t(`${emptyKey}-text`)}
            action={emptyAction}
        />
    )

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: `${user?.name} - ${title}${pageTitle}`,
                    description: `${user?.name} - ${title}${pageTitle}`,
                    canonical: `${canonicalUrl}${linkPart}${encodeQueryData({
                        page: currentPage > 1 ? currentPage : undefined,
                        show: showParam
                    })}`,
                    noindex: true,
                    nofollow: false,
                    openGraph: {
                        description: `${user?.name} - ${title}${pageTitle}`,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: `${user?.name} - ${title}${pageTitle}`,
                        type: 'website',
                        url: `${canonicalUrl}${linkPart}`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(linkPart)
                })}
            </Head>

            <UserHero
                user={user}
                currentPage={'places'}
            />

            <nav
                className={styles.switch}
                aria-label={t('user-tab-places')}
            >
                {SHOWS.map((item) => (
                    <Chip
                        key={item}
                        size={'small'}
                        label={t(`user-places-${item}`)}
                        count={counts[item]}
                        selected={show === item}
                        href={`/${linkPart}${item === 'added' ? '' : `?show=${item}`}`}
                    />
                ))}
            </nav>

            {!listData.isLoading && !listData.data?.items?.length ? (
                empty
            ) : (
                <PlacesList
                    places={listData.data?.items}
                    loading={listData.isLoading}
                />
            )}

            <PaginationBar
                currentPage={currentPage}
                totalItemsCount={listData.data?.count ?? 0}
                perPage={PLACES_PER_PAGE}
                linkPart={linkPart}
                urlParam={showParam ? { show: showParam } : undefined}
            />
        </AppLayout>
    )
}

const prefetch = async (
    store: AppStore,
    id: string,
    show: UserPlacesShow,
    page: number,
    location: ApiType.Coordinates | null
) => {
    if (show === 'visited') {
        await store.dispatch(API.endpoints.visitsGetPlaces.initiate(visitedRequest(id, page)))
    } else {
        await store.dispatch(API.endpoints.placesGetList.initiate(placesRequest(id, show, page, location)))
    }
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserPlacesPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const currentPage = parseInt(context.query.page as string, 10) || 1
            const show = parseUserPlacesShow(context.query.show)
            const translations = await loadPageTranslations()

            if (typeof id !== 'string') {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const userLocation = getUserLocationFromCookies(context.req.cookies) ?? null

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            if (isError) {
                return { notFound: true }
            }

            await prefetch(store, id, show, currentPage, userLocation)
            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    id,
                    currentPage,
                    show,
                    user: userData,
                    userLocation
                }
            }
        }
)

export default UserPlacesPage
