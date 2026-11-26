import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { AdminPageShell } from '@/components/shared'
import { MailingForm, MailingFormMode, MailingModeSwitch } from '@/sections/admin/mailing-form'
import { ADMIN_MAILINGS_HREF } from '@/utils/admin'
import { getAdminServerSideProps } from '@/utils/adminPage'

const AdminMailingsCreate: React.FC = () => {
    const { t } = useTranslation()

    const [mode, setMode] = React.useState<MailingFormMode>('edit')

    return (
        <AdminPageShell
            title={t('admin-mailing-create')}
            section={{ href: ADMIN_MAILINGS_HREF, title: t('admin-mailings-title') }}
            actions={
                <MailingModeSwitch
                    mode={mode}
                    onChange={setMode}
                />
            }
        >
            <MailingForm mode={mode} />
        </AdminPageShell>
    )
}

export const getServerSideProps = getAdminServerSideProps

export default AdminMailingsCreate
