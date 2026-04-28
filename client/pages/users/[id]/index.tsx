import React, { useCallback, useEffect, useState } from 'react'
import type { BreadcrumbList, ProfilePage } from 'schema-dts'
import { Button } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { ActivityList, AppLayout, PhotoGallery } from '@/components/shared'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { UserHeader, UserPagesEnum, UserTabs } from '@/sections/user'
import { formatDateISO } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'

interface UserPageProps {
    id: string
    user?: ApiModel.User
    photosList?: ApiModel.Photo[]
    photosCount: number
}

const UserPage: React.FC<UserPageProps> = ({ id, user, photosList, photosCount }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const [lastDate, setLastDate] = useState<string>()

    const { data, isFetching } = API.useActivityGetInfinityListQuery({
        author: user?.id,
        date: lastDate
    })

    const onScroll = useCallback(() => {
        const scrolledToBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 20

        if (scrolledToBottom && !isFetching && !!data?.items.length) {
            setLastDate(data.items[data.items.length - 1].created?.date)
        }
    }, [isFetching, data])

    useEffect(() => {
        document.addEventListener('scroll', onScroll)

        return () => {
            document.removeEventListener('scroll', onScroll)
        }
    }, [onScroll])

    useEffect(() => {
        setLastDate(undefined)
    }, [id])

    const breadCrumbSchema: unknown | BreadcrumbList = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                item: `${canonicalUrl}users`,
                name: t('users'),
                position: 1
            },
            {
                '@type': 'ListItem',
                item: `${canonicalUrl}users/${user?.id}`,
                name: user?.name,
                position: 2
            }
        ]
    }

    const userSchema: unknown | ProfilePage = {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        dateCreated: formatDateISO(user?.created?.date),
        dateModified: formatDateISO(user?.updated?.date),
        mainEntity: {
            '@type': 'Person',
            identifier: user?.id,
            image: user?.avatar ? `${IMG_HOST}${user.avatar}` : undefined,
            name: user?.name
        }
    }

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: `${user?.name} - ${t('profile')}`,
                    canonical: `${canonicalUrl}users/${user?.id}`,
                    description: `${user?.name} - ${t('user-profile')}`,
                    openGraph: {
                        images: photosList?.map((photo, index) => ({
                            alt: `${photo.title} (${index + 1})`,
                            height: photo.height,
                            url: `${IMG_HOST}${photo.full}`,
                            width: photo.width
                        })),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        profile: {
                            username: user?.name
                        },
                        siteName: t('geotags'),
                        title: user?.name,
                        type: 'http://ogp.me/ns/profile#',
                        url: `${canonicalUrl}users/${user?.id}`
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags(`users/${user?.id}`)
                })}
                <script
                    type={'application/ld+json'}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(breadCrumbSchema)
                    }}
                />
                <script
                    type={'application/ld+json'}
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(userSchema)
                    }}
                />
            </Head>

            <UserHeader user={user} />

            <PhotoGallery
                title={t('photos')}
                photos={photosList}
                hideActions={true}
                action={
                    !!photosList?.length && (
                        <Link
                            href={`/users/${id}/photos`}
                            title={t(`${t('show-all-photos')} (${photosCount})`)}
                        >
                            {t('all')}
                        </Link>
                    )
                }
                footer={
                    photosCount > 8 && (
                        <Button
                            size={'medium'}
                            mode={'secondary'}
                            link={`/users/${id}/photos`}
                            style={{ marginTop: '5px', width: '100%' }}
                        >
                            {`${t('show-all-photos')} (${photosCount})`}
                        </Button>
                    )
                }
            />

            <UserTabs
                user={user}
                currentPage={UserPagesEnum.FEED}
            />

            <ActivityList
                activities={data?.items}
                loading={isFetching}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            if (typeof id !== 'string') {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            const { data: photosData } = await store.dispatch(
                API.endpoints.photosGetList.initiate({
                    author: id,
                    limit: 8,
                    offset: 0
                })
            )

            await store.dispatch(
                API.endpoints.activityGetInfinityList.initiate({
                    author: id
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
                    photosCount: photosData?.count ?? 0,
                    photosList: photosData?.items ?? [],
                    user: userData
                }
            }
        }
)

export default UserPage
