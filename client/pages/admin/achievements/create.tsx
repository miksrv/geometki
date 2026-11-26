import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { AdminPageShell } from '@/components/shared'
import { AchievementForm, ACHIEVEMENTS_ADMIN_HREF } from '@/sections/admin/achievement-form'
import { getAdminServerSideProps } from '@/utils/adminPage'

const AdminAchievementsCreate: React.FC = () => {
    const { t } = useTranslation()

    return (
        <AdminPageShell
            title={t('achievements-admin-add')}
            section={{ href: ACHIEVEMENTS_ADMIN_HREF, title: t('achievements-admin-title') }}
        >
            <AchievementForm />
        </AdminPageShell>
    )
}

export const getServerSideProps = getAdminServerSideProps

export default AdminAchievementsCreate
