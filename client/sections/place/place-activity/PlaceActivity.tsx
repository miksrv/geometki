import React, { useState } from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { FeedList, Section } from '@/components/shared'
import { flattenFeedPages } from '@/utils/feed'

import styles from './styles.module.sass'

const HISTORY_LIMIT = 10

interface PlaceActivityProps {
    placeId?: string
}

/**
 * "История изменений (N)": a collapsed row at the end of the place page. The page prefetches
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
        <Section
            className={styles.history}
            // The heading itself is the disclosure control: same h2 as every other section
            title={
                <button
                    type={'button'}
                    className={cn(styles.toggle, open && styles.open)}
                    aria-expanded={open}
                    onClick={() => setOpen((prev) => !prev)}
                >
                    {t('place-history', { defaultValue: 'История изменений' })}
                    {!!count && ` (${count})`}
                    <Icon
                        name={'KeyboardDown'}
                        className={styles.chevron}
                    />
                </button>
            }
        >
            {open && (
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
            )}
        </Section>
    )
}
