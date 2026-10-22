import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { EmptyState, PaginationBar, UserCard } from '@/components/shared'

import styles from './styles.module.sass'

interface UsersListingProps<T> {
    users: ApiModel.User[]
    count: number
    currentPage: number
    perPage: number
    /** The request behind `users` without `limit`/`offset`: the next pages are loaded with it */
    request: ApiType.Users.ListRequest
    /** Number the cards: the list is a ranking (by experience or reputation, no search) */
    ranked?: boolean
    /** `PaginationBar` props: the query kept in the page links */
    urlParam?: T
}

/**
 * The people grid with its pagination, the same pattern as `PlacesListing`: the page links on
 * desktop, "Показать ещё" appending the next page on phones (the links stay in the markup).
 * The parent keys it by the request and the page, so a new list starts clean.
 */
export const UsersListing = <T,>({
    users,
    count,
    currentPage,
    perPage,
    request,
    ranked,
    urlParam
}: UsersListingProps<T>) => {
    const { t } = useTranslation()

    const [more, setMore] = useState<ApiModel.User[]>([])
    // Pages appended by "Показать ещё": counted apart from the cards, since repeats are dropped
    const [loadedPages, setLoadedPages] = useState(0)
    const [loadPage, { isFetching }] = API.useLazyUsersGetListQuery()

    const firstIndex = (currentPage - 1) * perPage
    const lastShownPage = currentPage + loadedPages
    const totalPages = Math.max(1, Math.ceil(count / perPage))
    const hasMore = lastShownPage * perPage < count

    const handleLoadMore = async () => {
        const { data } = await loadPage({ ...request, limit: perPage, offset: lastShownPage * perPage })

        if (data?.items?.length) {
            setLoadedPages((prev) => prev + 1)
            // The order may shift between the pages (someone was active meanwhile): a person
            // already shown is not shown twice
            setMore((prev) => {
                const shownIds = new Set([...users, ...prev].map(({ id }) => id))
                return [...prev, ...(data.items as ApiModel.User[]).filter(({ id }) => !shownIds.has(id))]
            })
        }
    }

    if (!users.length) {
        return (
            <EmptyState
                title={t('users-empty-title', 'Никого не нашли')}
                description={t('users-empty-description', 'Нет людей с таким именем. Проверьте написание.')}
            />
        )
    }

    return (
        <>
            <section className={styles.grid}>
                {[...users, ...more].map((user, index) => (
                    <UserCard
                        key={user.id}
                        user={user}
                        rank={ranked ? firstIndex + index + 1 : undefined}
                    />
                ))}
            </section>

            {hasMore && (
                <div className={styles.more}>
                    <Button
                        mode={'secondary'}
                        size={'large'}
                        stretched={true}
                        loading={isFetching}
                        label={t('places-load-more', 'Показать ещё {{count}}', {
                            count: Math.min(perPage, count - lastShownPage * perPage)
                        })}
                        onClick={() => void handleLoadMore()}
                    />
                    <span className={styles.pages}>
                        {t('places-page-of', 'Страница {{page}} из {{total}}', {
                            page: lastShownPage,
                            total: totalPages
                        })}
                    </span>
                </div>
            )}

            <div className={styles.pagination}>
                <PaginationBar
                    currentPage={currentPage}
                    totalItemsCount={count}
                    perPage={perPage}
                    urlParam={urlParam}
                    linkPart={'users'}
                />
            </div>
        </>
    )
}
