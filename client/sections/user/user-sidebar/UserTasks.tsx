import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { GameAwards } from '@/sections/game/game-awards'

interface UserTasksProps {
    userId: string
}

/**
 * "Задания" in the side column of a profile: the limited awards running now (begun, not over),
 * whatever season is on — the ones the season's page calls "Награды сезона" —, with the
 * person's progress, or a check once earned. An award made ahead shows up on the day it begins.
 * Asked in the browser (the profile is cached without a viewer); nothing while none is running.
 */
export const UserTasks: React.FC<UserTasksProps> = ({ userId }) => {
    const { t } = useTranslation()
    const { data } = API.useGameGetUserTasksQuery(userId, { skip: !userId })

    return (
        <GameAwards
            title={t('user-side-tasks')}
            awards={data?.data}
        />
    )
}
