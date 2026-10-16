import React, { useEffect, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { PaginationBar, PlacesList } from '@/components/shared'

import styles from './styles.module.sass'

interface PlacesListingProps<T> {
    places: ApiModel.Place[]
    count: number
    currentPage: number
    perPage: number
    /** The request behind `places` without `limit`/`offset`: the next pages are loaded with it */
    request: ApiType.Places.ListRequest
    /** `PaginationBar` props: the query kept in the page links and the path they go to */
    urlParam?: T
    linkPart: string
}

/**
 * The grid of a places listing and its pagination. Desktop: the page links (crawlable,
 * shareable). Phones: "Показать ещё" appends the next page under the same URL, with "Страница
 * 1 из N" under it — the links stay in the markup for crawlers, only hidden.
 */
export const PlacesListing = <T,>({
    places,
    count,
    currentPage,
    perPage,
    request,
    urlParam,
    linkPart
}: PlacesListingProps<T>) => {
    const { t } = useTranslation()

    const [more, setMore] = useState<ApiModel.Place[]>([])
    const [loadPage, { isFetching }] = API.useLazyPlacesGetListQuery()

    // A new list (filters, page): forget what was appended to the old one
    useEffect(() => setMore([]), [places])

    const shown = places.length + more.length
    const lastShownPage = currentPage + Math.ceil(more.length / perPage)
    const totalPages = Math.max(1, Math.ceil(count / perPage))
    const hasMore = (currentPage - 1) * perPage + shown < count

    const handleLoadMore = async () => {
        const { data } = await loadPage({ ...request, limit: perPage, offset: lastShownPage * perPage })

        if (data?.items?.length) {
            setMore((prev) => [...prev, ...(data.items as ApiModel.Place[])])
        }
    }

    return (
        <>
            <PlacesList places={[...places, ...more]} />

            {hasMore && (
                <div className={styles.more}>
                    <Button
                        mode={'secondary'}
                        size={'large'}
                        stretched={true}
                        loading={isFetching}
                        label={t('places-load-more', 'Показать ещё {{count}}', {
                            count: Math.min(perPage, count - (currentPage - 1) * perPage - shown)
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
                    linkPart={linkPart}
                />
            </div>
        </>
    )
}
