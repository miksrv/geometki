import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'

import { ActivityListItem } from './ActivityListItem'
import { ActivityListItemLoader } from './ActivityListItemLoader'

interface ActivityListProps {
    activities?: ApiModel.Activity[]
    title?: string
    loading?: boolean
    compact?: boolean
}

export const ActivityList: React.FC<ActivityListProps> = ({ activities, loading, title, compact }) => {
    const { t } = useTranslation('components.activity-list')

    if (!activities?.length && !loading) {
        return (
            <Container className={'emptyList'}>
                {t('nothing-here-yet', { defaultValue: 'Тут пока ничего нет' })}
            </Container>
        )
    }

    return (
        <Container title={title}>
            {activities?.map((item, index) => (
                <ActivityListItem
                    key={`activity-${index}`}
                    item={item}
                    compact={compact}
                />
            ))}

            {loading && <ActivityListItemLoader />}
        </Container>
    )
}
