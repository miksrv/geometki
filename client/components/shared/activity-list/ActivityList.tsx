import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'

import { ActivityListItem } from './ActivityListItem'
import { ActivityListItemLoader } from './ActivityListItemLoader'

interface ActivityListProps {
    activities?: ApiModel.Activity[]
    title?: string
    loading?: boolean
}

export const ActivityList: React.FC<ActivityListProps> = ({ activities, loading, title }) => {
    const { t } = useTranslation('components.activity-list')

    return (
        <>
            {activities?.map((item, index) => (
                <ActivityListItem
                    key={`activity-${index}`}
                    item={item}
                    title={title && index === 0 ? title : undefined}
                />
            ))}

            {!activities?.length && !loading && (
                <Container
                    style={{ marginTop: 15 }}
                    className={'emptyList'}
                >
                    {t('nothing-here-yet', { defaultValue: 'Тут пока ничего нет' })}
                </Container>
            )}

            {loading && <ActivityListItemLoader />}
        </>
    )
}
