import React from 'react'
import { Button } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { ActivityList, AppLayout, PlacesListItem, UsersList } from '@/components/shared'
import { Carousel } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { MapHero, PopularCategories } from '@/sections/home'
import { PlaceSchema, UserSchema } from '@/utils/schema'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

import styles from './index.module.sass'

interface IndexPageProps {
    placesList: ApiModel.Place[]
    usersList: ApiModel.User[]
    activityList: ApiModel.Activity[]
    topCategories: ApiModel.TopCategory[]
    stats?: ApiType.Stats.GetResponse
}

const IndexPage: NextPage<IndexPageProps> = ({ placesList, usersList, activityList, topCategories, stats }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

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
                    name: 'Geometki',
                    url: SITE_LINK
                }}
            />
            <JsonLdScript
                scriptKey={'website'}
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebSite',
                    name: 'Geometki',
                    url: SITE_LINK,
                    potentialAction: {
                        '@type': 'SearchAction',
                        target: {
                            '@type': 'EntryPoint',
                            urlTemplate: `${SITE_LINK}places?search={search_term_string}`
                        },
                        'query-input': 'required name=search_term_string'
                    }
                }}
            />
            <JsonLdScript
                scriptKey={'places-users'}
                data={[
                    ...placesList.map((place) => PlaceSchema(place, SITE_LINK)),
                    ...usersList.map((user) => UserSchema(user, SITE_LINK))
                ]}
            />

            <MapHero
                stats={stats}
                places={placesList}
            />

            <Carousel options={{ dragFree: true, loop: true }}>
                {placesList.map((place) => (
                    <PlacesListItem
                        t={t}
                        key={place.id}
                        place={place}
                    />
                ))}
            </Carousel>

            <Button
                size={'medium'}
                mode={'secondary'}
                link={'/places'}
                stretched={true}
                label={t('all-geotags')}
            />

            <div className={styles.twoColumns}>
                <ActivityList
                    scrollable={true}
                    compact={true}
                    title={t('activity-feed')}
                    activities={activityList}
                    action={
                        <Link
                            href={'/activity'}
                            title={t('news-feed')}
                        >
                            {t('all')}
                        </Link>
                    }
                />

                <UsersList
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
            </div>

            <PopularCategories categories={topCategories} />
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

            const [
                { data: placesList },
                { data: usersList },
                { data: stats },
                { data: activityList },
                { data: topCategoriesData }
            ] = await Promise.all([
                store.dispatch(
                    API.endpoints.placesGetList.initiate({
                        limit: 6,
                        order: ApiType.SortOrders.DESC,
                        sort: ApiType.SortFields.ViewsWeek
                    })
                ),
                store.dispatch(API.endpoints.usersGetList.initiate({ limit: 15 })),
                store.dispatch(API.endpoints.statsGetSummary.initiate()),
                store.dispatch(API.endpoints.activityGetList.initiate({ limit: 40 })),
                store.dispatch(API.endpoints.categoriesGetTop.initiate({ limit: 6 }))
            ])

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    activityList: activityList?.items || [],
                    placesList: placesList?.items || [],
                    stats: stats ?? undefined,
                    topCategories: topCategoriesData?.items ?? [],
                    usersList: usersList?.items || []
                }
            }
        }
)

export default IndexPage
