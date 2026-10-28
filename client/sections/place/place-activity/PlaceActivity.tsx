import React, { useState } from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { FeedList } from '@/components/shared'
import { flattenFeedPages } from '@/utils/feed'

import styles from './styles.module.sass'

const HISTORY_LIMIT = 10

interface PlaceActivityProps {
    placeId?: string
}

/**
 * "Журнал активности  N": a collapsed row at the end of the "О месте" card. The page prefetches
 * the count on the server (a count-only request, no stories); the history itself — the feed
 * stories of the place, without the place attached — loads on the first click.
 */
export const PlaceActivity: React.FC<PlaceActivityProps> = ({ placeId }) => {
    const { t } = useTranslation()

    const [open, setOpen] = useState<boolean>(false)

    const { data: countData } = API.useFeedGetStoriesQuery({ countOnly: true, place: placeId }, { skip: !placeId })

    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = API.useFeedGetListInfiniteQuery(
        { limit: HISTORY_LIMIT, place: placeId },
        { skip: !placeId || !open }
    )

    const count = data?.pages[0]?.count ?? countData?.count

    return (
        <div className={styles.history}>
            {/* The heading is the disclosure control: in the outline of the page, one tap to open */}
            <h3 className={styles.heading}>
                <button
                    type={'button'}
                    className={cn(styles.toggle, open && styles.open)}
                    aria-expanded={open}
                    onClick={() => setOpen((prev) => !prev)}
                >
                    <Icon
                        name={'Time'}
                        className={styles.icon}
                    />
                    {t('place-history', { defaultValue: 'Журнал активности' })}
                    {!!count && <small>{count}</small>}
                    <Icon
                        name={'KeyboardDown'}
                        className={styles.chevron}
                    />
                </button>
            </h3>

            {open && (
                <div className={styles.stories}>
                    <FeedList
                        stories={flattenFeedPages(data?.pages)}
                        loading={isLoading || isFetchingNextPage}
                        density={'compact'}
                        hidePlace={true}
                        footer={
                            hasNextPage ? (
                                <Button
                                    mode={'secondary'}
                                    stretched={true}
                                    disabled={isFetchingNextPage}
                                    loading={isFetchingNextPage}
                                    onClick={() => fetchNextPage()}
                                >
                                    {t('show-more')}
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            )}
        </div>
    )
}
