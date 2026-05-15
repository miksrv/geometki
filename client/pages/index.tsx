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
import { AppLayout, PlacesListItem, UsersList } from '@/components/shared'
import { Carousel } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { MapHero } from '@/sections/home'
import { PlaceSchema, UserSchema } from '@/utils/schema'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

interface IndexPageProps {
    placesList: ApiModel.Place[]
    usersList: ApiModel.User[]
    stats?: ApiType.Stats.GetResponse
}

const IndexPage: NextPage<IndexPageProps> = ({ placesList, usersList, stats }) => {
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

            <UsersList
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

            const [{ data: placesList }, { data: usersList }, { data: stats }] = await Promise.all([
                store.dispatch(
                    API.endpoints.placesGetList.initiate({
                        limit: 6,
                        order: ApiType.SortOrders.DESC,
                        sort: ApiType.SortFields.ViewsWeek
                    })
                ),
                store.dispatch(API.endpoints.usersGetList.initiate({ limit: 4 })),
                store.dispatch(API.endpoints.statsGetSummary.initiate())
            ])

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    placesList: placesList?.items || [],
                    stats: stats ?? undefined,
                    usersList: usersList?.items || []
                }
            }
        }
)

export default IndexPage
