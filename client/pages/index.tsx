import React from 'react'
import { Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AppLayout, FeedList, FeedPulse, LocationLinkList, UsersList } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import {
    HOME_COLLECTIONS_COUNT,
    HomeCategories,
    HomeCollections,
    HomeHero,
    HomeHowItWorks,
    HomeJoin,
    HomePlaces,
    HomeUnexplored,
    HomeWelcome
} from '@/sections/home'
import { getCategoryShortTitle } from '@/utils/categories'
import { buildCategoryHref, buildLocationHref, buildPlaceUrl, getLandingFlags } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { getUserLocationFromCookies } from '@/utils/userLocation'

import styles from './index.module.sass'

/** Stories in the home page widget: the latest big events, the small ones are on /activity */
const HOME_FEED_LIMIT = 5

/** A guest's feed sits next to the people list: about as tall with fewer stories */
const HOME_GUEST_FEED_LIMIT = 3

/** Places per tab of "Куда поехать" */
const HOME_PLACES_LIMIT = 8

/** Russia: the regions block lists the regions of the site's home country */
const HOME_COUNTRY_ID = 1
const HOME_REGIONS_LIMIT = 12

/** A collection on the home page is an idea for a trip: a few places, with covers */
const HOME_COLLECTION_MIN_PLACES = 3

interface IndexPageProps {
    popularPlaces: ApiModel.Place[]
    latestPlaces: ApiModel.Place[]
    usersList: ApiModel.User[]
    feedStories: ApiModel.FeedStory[]
    collections: ApiModel.Collection[]
    regions: ApiType.Locations.LocationChildItem[]
    feedPulse?: ApiType.Feed.PulseResponse | null
    stats?: ApiType.Stats.GetResponse
    /** The signed-in user with the statistic, for the welcome panel; undefined for a guest */
    currentUser?: ApiModel.User | null
}

const IndexPage: NextPage<IndexPageProps> = ({
    popularPlaces,
    latestPlaces,
    usersList,
    feedStories,
    collections,
    regions,
    feedPulse,
    stats,
    currentUser
}) => {
    const { t, i18n } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const authUser = useAppSelector((state) => state.auth.user)

    // Signed in on this page (or the server could not load the profile): load it here, the
    // page turns into the signed-in one as soon as it comes
    const { data: loadedProfile } = API.useUsersGetItemQuery(authUser?.id ?? '', {
        skip: isAuth !== true || !!currentUser || !authUser?.id
    })

    // `/en`, not `/en/`: the trailing slash is a redirect, and the hreflang links name `/en` too
    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en' : '')

    const user =
        isAuth === true
            ? (currentUser ??
              (loadedProfile && authUser
                  ? { ...authUser, ...loadedProfile, levelData: loadedProfile.levelData ?? authUser.levelData }
                  : undefined))
            : undefined

    const flags = getLandingFlags()
    const regionLinks = regions.map((region) => ({
        count: region.placesCount,
        href: buildLocationHref(region, flags),
        key: `${region.type}-${region.id}`,
        title: region.title
    }))
    const categoryLinks = (stats?.categories ?? []).map(({ name, count }) => ({
        count,
        href: buildCategoryHref(name, flags),
        key: name,
        title: getCategoryShortTitle(t, name)
    }))

    const renderFeedWidget = (limit: number) => (
        <Container
            title={t('activity-feed')}
            action={
                <Link
                    href={'/activity'}
                    title={t('activity-feed')}
                >
                    {t('all')}
                </Link>
            }
        >
            <div className={styles.feedWidget}>
                <FeedPulse
                    pulse={feedPulse ?? undefined}
                    compact={true}
                />
                <FeedList
                    stories={feedStories.slice(0, limit)}
                    density={'compact'}
                />
            </div>
        </Container>
    )

    const usersWidget = (
        <UsersList
            compact={true}
            scrollable={true}
            title={t('active-users')}
            users={usersList}
            action={
                <Link
                    href={'/users'}
                    title={t('all-users')}
                >
                    {t('all')}
                </Link>
            }
        />
    )

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('home-seo-title'),
                    description: t('geotags-description'),
                    canonical: canonicalUrl,
                    openGraph: {
                        description: t('geotags-description'),
                        images: [
                            {
                                alt: t('home-seo-title'),
                                height: 1538,
                                url: `${SITE_LINK}images/pages/main.jpg`,
                                width: 1768
                            }
                        ],
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: t('home-seo-title'),
                        type: 'website',
                        url: canonicalUrl
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('')
                })}
            </Head>
            <JsonLdScript
                scriptKey={'organization'}
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Organization',
                    logo: `${SITE_LINK}android-chrome-512x512.png`,
                    name: t('geotags'),
                    url: SITE_LINK
                }}
            />
            <JsonLdScript
                scriptKey={'website'}
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebSite',
                    name: t('geotags'),
                    url: SITE_LINK
                }}
            />
            <JsonLdScript
                scriptKey={'popular-places'}
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'ItemList',
                    itemListElement: popularPlaces.map((place, index) => ({
                        '@type': 'ListItem',
                        name: place.title,
                        position: index + 1,
                        // The same place URL every list of the site names, in both locales (utils/schema.ts)
                        url: `${SITE_LINK}${buildPlaceUrl(place.id, place.slug).replace(/^\//, '')}`
                    }))
                }}
            />

            {user ? (
                <div className={styles.home}>
                    <HomeWelcome user={user} />

                    <div className={styles.userColumns}>
                        {renderFeedWidget(HOME_FEED_LIMIT)}
                        <div className={styles.sideColumn}>
                            <HomeUnexplored total={stats?.unexplored} />
                            {usersWidget}
                        </div>
                    </div>

                    <LocationLinkList
                        title={t('home-categories-links-title')}
                        items={categoryLinks}
                    />

                    <HomePlaces
                        popular={popularPlaces}
                        latest={latestPlaces}
                    />

                    <HomeCollections collections={collections} />
                </div>
            ) : (
                <div className={styles.home}>
                    <HomeHero
                        stats={stats}
                        pulse={feedPulse ?? undefined}
                    />

                    <HomeCategories categories={stats?.categories} />

                    <HomePlaces
                        popular={popularPlaces}
                        latest={latestPlaces}
                    />

                    <HomeHowItWorks categories={stats?.categories} />

                    <HomeCollections collections={collections} />

                    <LocationLinkList
                        title={t('home-regions-title')}
                        items={regionLinks}
                    />

                    <div className={styles.twoColumns}>
                        {renderFeedWidget(HOME_GUEST_FEED_LIMIT)}
                        {usersWidget}
                    </div>

                    <HomeJoin />
                </div>
            )}
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<IndexPageProps>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const location = getUserLocationFromCookies(cookies)

            const signedIn = !!store.getState().auth.isAuth

            // The welcome panel needs the user's statistic, which only the profile carries: the
            // id comes from `auth/me`, then the profile; both run alongside the other requests
            const loadCurrentUser = async (): Promise<ApiModel.User | undefined> => {
                const { data: me } = await store.dispatch(API.endpoints.authGetMe.initiate())

                if (!me?.user?.id) {
                    return undefined
                }

                const { data: profile } = await store.dispatch(API.endpoints.usersGetItem.initiate(me.user.id))

                // The profile's level is counted after the server re-checks it: the fresher one
                return { ...me.user, ...profile, levelData: profile?.levelData ?? me.user.levelData }
            }

            const [
                currentUser,
                { data: popular },
                { data: latest },
                { data: usersList },
                { data: stats },
                { data: feed },
                { data: feedPulse },
                { data: collections },
                { data: regions }
            ] = await Promise.all([
                signedIn ? loadCurrentUser() : Promise.resolve(undefined),
                store.dispatch(
                    API.endpoints.placesGetList.initiate({
                        ...location,
                        limit: HOME_PLACES_LIMIT,
                        order: ApiType.SortOrders.DESC,
                        sort: ApiType.SortFields.ViewsWeek
                    })
                ),
                store.dispatch(
                    API.endpoints.placesGetList.initiate({
                        ...location,
                        limit: HOME_PLACES_LIMIT,
                        order: ApiType.SortOrders.DESC,
                        sort: ApiType.SortFields.Created
                    })
                ),
                store.dispatch(API.endpoints.usersGetList.initiate({ limit: 15 })),
                store.dispatch(API.endpoints.statsGetSummary.initiate()),
                store.dispatch(
                    API.endpoints.feedGetStories.initiate({
                        limit: signedIn ? HOME_FEED_LIMIT : HOME_GUEST_FEED_LIMIT,
                        weight: 2
                    })
                ),
                store.dispatch(API.endpoints.feedGetPulse.initiate()),
                store.dispatch(API.endpoints.collectionsGetList.initiate({ limit: 12, sort: 'popular' })),
                // Only the guest page has the regions block
                signedIn
                    ? Promise.resolve({ data: undefined })
                    : store.dispatch(
                          API.endpoints.locationsGetChildren.initiate({ id: HOME_COUNTRY_ID, type: 'country' })
                      )
            ])

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    collections: (collections?.items ?? [])
                        .filter((item) => item.placesCount >= HOME_COLLECTION_MIN_PLACES && item.covers?.length)
                        .slice(0, HOME_COLLECTIONS_COUNT),
                    currentUser: currentUser ?? null,
                    feedPulse: feedPulse ?? null,
                    feedStories: feed?.items || [],
                    latestPlaces: latest?.items || [],
                    popularPlaces: popular?.items || [],
                    regions: (regions?.items ?? []).slice(0, HOME_REGIONS_LIMIT),
                    stats: stats ?? undefined,
                    usersList: usersList?.items || []
                }
            }
        }
)

export default IndexPage
