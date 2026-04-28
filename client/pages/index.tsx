import React, { useCallback, useEffect, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { ActivityList, AppLayout, Header, PlacesListItem, UsersList } from '@/components/shared'
import { Carousel } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { PlaceSchema, UserSchema } from '@/utils/schema'
import { buildHreflangTags } from '@/utils/seo'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

interface IndexPageProps {
    placesList: ApiModel.Place[]
    usersList: ApiModel.User[]
}

const IndexPage: NextPage<IndexPageProps> = ({ placesList, usersList }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en' : '')

    const [lastDate, setLastDate] = useState<string>()

    const { data, isFetching } = API.useActivityGetInfinityListQuery({ date: lastDate })

    const onScroll = useCallback(() => {
        const scrolledToBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 20
        const cursorDate = data?.items[data.items.length - 1]?.created?.date

        if (scrolledToBottom && !isFetching && cursorDate) {
            setLastDate(cursorDate)
        }
    }, [data, isFetching])

    useEffect(() => {
        document.addEventListener('scroll', onScroll)

        return () => {
            document.removeEventListener('scroll', onScroll)
        }
    }, [onScroll])

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('news-feed') + ' - ' + t('interesting-places'),
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
                        title: t('news-feed'),
                        type: 'website',
                        url: canonicalUrl
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('')
                })}
                <script
                    type={'application/ld+json'}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'Organization',
                            logo: `${SITE_LINK}android-chrome-512x512.png`,
                            name: 'Geometki',
                            url: SITE_LINK
                        })
                    }}
                />
                <script
                    type={'application/ld+json'}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify([
                            ...placesList.map((place) => PlaceSchema(place)),
                            ...usersList.map((user) => UserSchema(user))
                        ])
                    }}
                />
            </Head>

            <Header
                title={t('news-feed') + ' - ' + t('interesting-places')}
                currentPage={t('updated-geotags-users-photos')}
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

            <ActivityList
                title={t('news-feed')}
                activities={data?.items}
                loading={isFetching}
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

            const { data: placesList } = await store.dispatch(
                API.endpoints.placesGetList.initiate({
                    limit: 6,
                    order: ApiType.SortOrders.DESC,
                    sort: ApiType.SortFields.ViewsWeek
                })
            )

            const { data: usersList } = await store.dispatch(
                API.endpoints.usersGetList.initiate({
                    limit: 4
                })
            )

            await store.dispatch(API.endpoints.activityGetInfinityList.initiate({}))

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    placesList: placesList?.items || [],
                    usersList: usersList?.items || []
                }
            }
        }
)

export default IndexPage
