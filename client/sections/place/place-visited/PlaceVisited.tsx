import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { UserAvatarGroup } from '@/components/shared'

import styles from './styles.module.sass'

interface PlaceVisitedProps {
    place?: ApiModel.Place
}

export const PlaceVisited: React.FC<PlaceVisitedProps> = ({ place }) => {
    const { t } = useTranslation()

    const { data: visitedData } = API.useVisitedGetUsersListQuery(place?.id ?? '', {
        skip: !place?.id
    })

    const visibleUsers = visitedData?.items?.slice(0, 5)
    const totalCount = visitedData?.total_count ?? 0
    const verifiedCount = visitedData?.verified_count ?? 0

    if (totalCount === 0) {
        return null
    }

    return (
        <Container className={styles.component}>
            <div className={styles.visitedStats}>
                <span>{t('visited-count', { total: totalCount })}</span>
                <span>·</span>
                <span>{t('visited-verified-count', { verified: verifiedCount })}</span>
            </div>

            {!!visibleUsers?.length && (
                <UserAvatarGroup
                    className={styles.visitedUsers}
                    users={visibleUsers}
                />
            )}
        </Container>
    )
}
