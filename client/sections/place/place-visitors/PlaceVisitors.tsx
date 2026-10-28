import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { UserAvatar } from '@/components/shared'
import { formatPlainDate } from '@/utils/date'

import styles from './styles.module.sass'

const MAX_AVATARS = 5

interface PlaceVisitorsProps {
    placeId?: string
}

/**
 * Who has been here, in the "Где это" card: a row of overlapping avatars of the latest visitors
 * and "N человек были здесь", under it the day of the last visit and the number of visits; or one
 * quiet line while nobody has checked in. The "Я здесь был(а)" button follows it in the card.
 * The query is prefetched with the place page (`loadPlacePage`).
 */
export const PlaceVisitors: React.FC<PlaceVisitorsProps> = ({ placeId }) => {
    const { t } = useTranslation()

    const { data } = API.useVisitsGetListQuery({ limit: 1, place: placeId }, { skip: !placeId })

    if (!placeId) {
        return null
    }

    const count = data?.count ?? 0
    const people = data?.people ?? 0
    const visitors = data?.visitors?.slice(0, MAX_AVATARS)

    if (!count) {
        return (
            <div className={styles.visitors}>
                <p>{t('visited-nobody-yet', { defaultValue: 'Пока никто не отметился' })}</p>
            </div>
        )
    }

    return (
        <div className={styles.visitors}>
            {!!visitors?.length && (
                <div className={styles.faces}>
                    {visitors.map((user) => (
                        <UserAvatar
                            key={user.id}
                            user={user}
                            size={'small'}
                            hideOnlineIcon={true}
                        />
                    ))}
                </div>
            )}
            <div className={styles.text}>
                <p>
                    <strong>{t('people-count', { count: people, defaultValue: '{{count}} человек' })}</strong>{' '}
                    {t('visited-were-here', { count: people, defaultValue: 'были здесь' })}
                </p>
                <p>
                    {data?.last && `${t('visit-last', { date: formatPlainDate(data.last) })} · `}
                    {t('visits-count', { count })}
                </p>
            </div>
        </div>
    )
}
