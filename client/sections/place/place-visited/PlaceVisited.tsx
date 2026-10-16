import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'

import styles from './styles.module.sass'

const MAX_AVATARS = 5

interface PlaceVisitedProps {
    place?: ApiModel.Place
}

/**
 * Who has been here, in the "Где это" card: a row of overlapping avatars and the count
 * ("3 человека были здесь"), or one quiet line while nobody has marked a visit. The
 * "Я здесь был(а)" button follows it in the card.
 */
export const PlaceVisited: React.FC<PlaceVisitedProps> = ({ place }) => {
    const { t } = useTranslation()

    const { data: visitedData } = API.useVisitedGetUsersListQuery(place?.id ?? '', {
        skip: !place?.id
    })

    const totalCount = visitedData?.total_count ?? 0
    const visibleUsers = visitedData?.items?.slice(0, MAX_AVATARS)

    if (!place?.id) {
        return null
    }

    return (
        <div className={styles.visited}>
            {!!visibleUsers?.length && (
                <div className={styles.faces}>
                    {visibleUsers.map((user) => (
                        <UserAvatar
                            key={user.id}
                            user={user}
                            size={'small'}
                            hideOnlineIcon={true}
                        />
                    ))}
                </div>
            )}
            <p>
                {totalCount ? (
                    <>
                        <strong>{t('people-count', { count: totalCount, defaultValue: '{{count}} человек' })}</strong>{' '}
                        {t('visited-were-here', { count: totalCount, defaultValue: 'были здесь' })}
                    </>
                ) : (
                    t('visited-nobody-yet', { defaultValue: 'Пока никто не отметил, что был здесь' })
                )}
            </p>
        </div>
    )
}
