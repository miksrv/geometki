import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { Tabs } from '@/components/ui'

export enum UserPagesEnum {
    FEED = 'feed',
    ACHIEVEMENTS = 'achievements',
    PLACES = 'places',
    BOOKMARKS = 'bookmarks',
    VISITED = 'visited',
    COLLECTIONS = 'collections',
    PHOTOS = 'photos'
}

interface UserTabsProps {
    user?: ApiModel.User
    currentPage?: UserPagesEnum
}

export const UserTabs: React.FC<UserTabsProps> = ({ user, currentPage }) => {
    const { t } = useTranslation()

    const tabs: Array<{ key: UserPagesEnum; label: string }> = [
        { key: UserPagesEnum.FEED, label: t('activity-feed') },
        { key: UserPagesEnum.ACHIEVEMENTS, label: t('achievements-title') },
        { key: UserPagesEnum.PLACES, label: t('geotags') },
        { key: UserPagesEnum.BOOKMARKS, label: t('favorites') },
        { key: UserPagesEnum.VISITED, label: t('visited-places') },
        { key: UserPagesEnum.COLLECTIONS, label: t('nav-collections', { defaultValue: 'Коллекции' }) },
        { key: UserPagesEnum.PHOTOS, label: t('photos') }
    ]

    return (
        <Tabs<UserPagesEnum>
            aria-label={`${user?.name}: ${t('user-profile-sections', { defaultValue: 'Разделы профиля' })}`}
            tabs={tabs.map((tab) => ({
                ...tab,
                href: `/users/${user?.id}${tab.key === UserPagesEnum.FEED ? '' : `/${tab.key}`}`
            }))}
            activeTab={currentPage}
        />
    )
}
