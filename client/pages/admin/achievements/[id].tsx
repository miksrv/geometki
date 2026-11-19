import React from 'react'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { useAppSelector } from '@/app/store'
import { AdminPageShell } from '@/components/shared'
import { useLastDefined } from '@/hooks/useLastDefined'
import { AchievementForm, ACHIEVEMENTS_ADMIN_HREF } from '@/sections/admin/achievement-form'
import { getAdminServerSideProps } from '@/utils/adminPage'

const AdminAchievementsEdit: React.FC = () => {
    const { t } = useTranslation()
    const router = useRouter()
    const achievementId = typeof router.query.id === 'string' ? router.query.id : undefined

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    // There is no endpoint for one achievement: it is found in the whole list of the admin
    const { data, isError } = API.useGetAchievementsManageQuery(undefined, { skip: !isAuth })
    const lastAchievement = useLastDefined(data?.data?.find(({ id }) => id === achievementId))
    const achievement = lastAchievement?.id === achievementId ? lastAchievement : undefined

    return (
        <AdminPageShell
            title={t('achievements-admin-edit')}
            section={{ href: ACHIEVEMENTS_ADMIN_HREF, title: t('achievements-admin-title') }}
            error={isError && !data}
            notFound={!!data && !achievement}
        >
            {/* While the list loads, the form stands in its place with everything off. Keyed by the
                achievement: the form takes the values once and keeps what is typed */}
            <AchievementForm
                key={achievement?.id ?? 'loading'}
                achievement={achievement}
                loading={!achievement}
            />
        </AdminPageShell>
    )
}

export const getServerSideProps = getAdminServerSideProps

export default AdminAchievementsEdit
