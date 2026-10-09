import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AppLayout, EmptyState, MediaTileGrid, PageHeader, PaginationBar, UserAvatar } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { CollectionCard, CreateCollectionButton } from '@/sections/collections'
import { UserPagesEnum, UserTabs } from '@/sections/user'
import { buildHreflangTags } from '@/utils/seo'

export const USER_COLLECTIONS_PER_PAGE = 40

interface UserCollectionsPageProps {
    id: string
    currentPage: number
    user?: ApiModel.User
    items: ApiModel.Collection[]
    count: number
}

const UserCollectionsPage: React.FC<UserCollectionsPageProps> = ({ id, user, currentPage, items, count }) => {
    const { t, i18n } = useTranslation()

    const ownUserId = useAppSelector((state) => state.auth.user?.id)
    const isOwnProfile = !!ownUserId && ownUserId === id

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')
    const title = t('nav-collections', { defaultValue: 'Коллекции' })

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: `${user?.name} - ${title}`,
                    description: `${user?.name} - ${title}`,
                    canonical: `${canonicalUrl}users/${id}/collections`,
                    noindex: true,
                    nofollow: false,
                    additionalLinkTags: buildHreflangTags(`users/${id}/collections`)
                })}
            </Head>

            <PageHeader
                title={`${title}`}
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
                actions={isOwnProfile && <CreateCollectionButton size={'small'} />}
            />

            <UserTabs
                user={user}
                currentPage={UserPagesEnum.COLLECTIONS}
            />

            {items.length ? (
                <MediaTileGrid>
                    {items.map((collection, index) => (
                        <CollectionCard
                            key={collection.id}
                            collection={collection}
                            priority={index < 3}
                        />
                    ))}
                </MediaTileGrid>
            ) : (
                <Container>
                    <EmptyState
                        title={
                            isOwnProfile
                                ? t('collections_empty-own-title', { defaultValue: 'У вас пока нет коллекций' })
                                : t('collections_empty-user-title', {
                                      defaultValue: 'У пользователя пока нет коллекций'
                                  })
                        }
                        description={
                            isOwnProfile
                                ? t('collections_empty-own-description', {
                                      defaultValue: 'Соберите места в тематическую подборку — например, по региону'
                                  })
                                : t('collections_empty-user-description', {
                                      defaultValue: 'Загляните сюда позже — возможно, он ещё соберёт первую подборку'
                                  })
                        }
                        action={isOwnProfile && <CreateCollectionButton />}
                    />
                </Container>
            )}

            <PaginationBar
                currentPage={currentPage}
                totalItemsCount={count}
                perPage={USER_COLLECTIONS_PER_PAGE}
                linkPart={`users/${id}/collections`}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<UserCollectionsPageProps>> => {
            const id = typeof context.params?.id === 'string' ? context.params.id : undefined
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)
            const currentPage = parseInt(context.query.page as string, 10) || 1

            if (!id) {
                return { notFound: true }
            }

            store.dispatch(setLocale(locale))

            const { data: userData, isError } = await store.dispatch(API.endpoints.usersGetItem.initiate(id))

            if (isError) {
                return { notFound: true }
            }

            const { data } = await store.dispatch(
                API.endpoints.collectionsGetList.initiate({
                    author: id,
                    limit: USER_COLLECTIONS_PER_PAGE,
                    offset: (currentPage - 1) * USER_COLLECTIONS_PER_PAGE
                })
            )

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    count: data?.count ?? 0,
                    currentPage,
                    id,
                    items: data?.items ?? [],
                    user: userData
                }
            }
        }
)

export default UserCollectionsPage
