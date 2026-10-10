import React, { useEffect, useState } from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { ActivityList, Section } from '@/components/shared'

import styles from './styles.module.sass'

const ACTIVITY_LIMIT = 10

interface PlaceActivityProps {
    placeId?: string
    hidePlaceName?: boolean
    hideCover?: boolean
}

/**
 * "История изменений (N)": a collapsed row at the end of the place page. The page prefetches
 * the count on the server (a count-only request: no rows, no view counters touched); the
 * list itself loads on the first click.
 */
export const PlaceActivity: React.FC<PlaceActivityProps> = ({ placeId, hidePlaceName, hideCover }) => {
    const { t } = useTranslation()

    const [open, setOpen] = useState<boolean>(false)
    const [offset, setOffset] = useState<number>(0)
    const [allItems, setAllItems] = useState<ApiModel.Activity[]>([])

    const { data: countData } = API.useActivityGetListQuery({ countOnly: true, place: placeId }, { skip: !placeId })

    const { data, isLoading, isFetching } = API.useActivityGetListQuery(
        { place: placeId, limit: ACTIVITY_LIMIT, offset },
        { skip: !placeId || !open }
    )

    const count = data?.count ?? countData?.count

    useEffect(() => {
        if (data?.items) {
            setAllItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]))
        }
    }, [data])

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
                <ActivityList
                    plain={true}
                    activities={allItems}
                    loading={isLoading}
                    compact={true}
                    hidePlaceName={hidePlaceName}
                    hideCover={hideCover}
                    footer={
                        data?.has_more ? (
                            <Button
                                mode={'secondary'}
                                stretched={true}
                                disabled={isFetching}
                                loading={isFetching}
                                onClick={() => setOffset((prev) => prev + ACTIVITY_LIMIT)}
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
