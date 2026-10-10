import React, { useEffect, useState } from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { ActivityList } from '@/components/shared'

import styles from './styles.module.sass'

const ACTIVITY_LIMIT = 10

interface PlaceActivityProps {
    placeId?: string
    hidePlaceName?: boolean
    hideCover?: boolean
}

/**
 * "История изменений (N)": a collapsed row at the end of the place page. Only the count
 * is fetched with the page (a one-row request); the list itself loads on the first click.
 */
export const PlaceActivity: React.FC<PlaceActivityProps> = ({ placeId, hidePlaceName, hideCover }) => {
    const { t } = useTranslation()

    const [open, setOpen] = useState<boolean>(false)
    const [offset, setOffset] = useState<number>(0)
    const [allItems, setAllItems] = useState<ApiModel.Activity[]>([])

    const { data: countData } = API.useActivityGetListQuery({ place: placeId, limit: 1 }, { skip: !placeId })

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
        <section
            className={styles.history}
            aria-label={t('place-history', { defaultValue: 'История изменений' })}
        >
            <h2 className={styles.title}>
                <button
                    type={'button'}
                    className={cn(styles.toggle, open && styles.open)}
                    aria-expanded={open}
                    onClick={() => setOpen((prev) => !prev)}
                >
                    {t('place-history', { defaultValue: 'История изменений' })}
                    {!!count && <span className={styles.count}>{` (${count})`}</span>}
                    <Icon
                        name={'KeyboardDown'}
                        className={styles.chevron}
                    />
                </button>
            </h2>

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
        </section>
    )
}
