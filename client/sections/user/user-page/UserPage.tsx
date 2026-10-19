import React from 'react'
import { Button } from 'simple-react-ui-kit'

import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { JsonLdScript } from 'next-seo'
import { generateNextSeo } from 'next-seo/pages'

import { ApiModel } from '@/api'
import { AppLayout, PhotoGallery } from '@/components/shared'
import { IMG_HOST, SITE_LINK } from '@/config/env'
import { UserActivity, UserHeader, UserPagesEnum, UserTabs } from '@/sections/user'
import { formatDateISO } from '@/utils/helpers'
import { buildHreflangTags } from '@/utils/seo'

export interface UserPageProps {
    id: string
    user?: ApiModel.User
    photosList?: ApiModel.Photo[]
    photosCount: number
}

export const UserPage: React.FC<UserPageProps> = ({ id, user, photosList, photosCount }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const breadCrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                item: canonicalUrl,
                name: t('geotags'),
                position: 1
            },
            {
                '@type': 'ListItem',
                item: `${canonicalUrl}users`,
                name: t('users'),
                position: 2
            },
            {
                '@type': 'ListItem',
                item: `${canonicalUrl}users/${user?.id}`,
                name: user?.name,
                position: 3
            }
        ]
    }

    const userSchema = {
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
                    noindex: true,
                    nofollow: false,
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
            </Head>

            <JsonLdScript
                scriptKey={'user-breadcrumb'}
                data={breadCrumbSchema}
            />
            <JsonLdScript
                scriptKey={'user-profile'}
                data={userSchema}
            />

            <UserHeader user={user} />

            <UserTabs
                user={user}
                currentPage={UserPagesEnum.FEED}
            />

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

            <UserActivity userId={id} />
        </AppLayout>
    )
}
