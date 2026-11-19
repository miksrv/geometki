import React from 'react'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { useAppSelector } from '@/app/store'
import { AdminPageShell } from '@/components/shared'
import { useLastDefined } from '@/hooks/useLastDefined'
import { defaultMailingMode, MailingForm, MailingFormMode, MailingModeSwitch } from '@/sections/admin/mailing-form'
import { ADMIN_MAILINGS_HREF } from '@/utils/admin'
import { getAdminServerSideProps } from '@/utils/adminPage'
import { isMailingDraft } from '@/utils/mailings'

const SENDING_POLL_MS = 10000

const AdminMailingsEdit: React.FC = () => {
    const { t } = useTranslation()
    const router = useRouter()
    const mailingId = typeof router.query.id === 'string' ? router.query.id : undefined

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [polling, setPolling] = React.useState<number>(0)

    const { data, error, isError } = API.useMailingsGetItemQuery(mailingId ?? '', {
        pollingInterval: polling,
        skip: !isAuth || !mailingId
    })

    // A sending mailing is read again from time to time: its numbers move
    React.useEffect(() => {
        setPolling(data?.status === 'sending' ? SENDING_POLL_MS : 0)
    }, [data?.status])

    const mailing = useLastDefined(data)

    // A draft opens on its fields, a sent mailing on its letter; the switch keeps what was chosen
    const [chosenMode, setChosenMode] = React.useState<MailingFormMode>()
    const mode = chosenMode ?? defaultMailingMode(mailing)

    const notFound = isError && !mailing && (error as { status?: number }).status === 404

    return (
        <AdminPageShell
            title={t('admin-mailing-edit')}
            section={{ href: ADMIN_MAILINGS_HREF, title: t('admin-mailings-title') }}
            notFound={notFound}
            error={isError && !mailing && !notFound}
            actions={
                <MailingModeSwitch
                    mode={mode}
                    readOnly={!!mailing && !isMailingDraft(mailing)}
                    disabled={!mailing}
                    onChange={setChosenMode}
                />
            }
        >
            {/* While the mailing loads, the form stands in its place with everything off. Keyed by the
                mailing, so that the form takes the texts once and keeps what is typed afterwards */}
            <MailingForm
                key={mailing?.id ?? 'loading'}
                mailing={mailing}
                loading={!mailing}
                mode={mode}
            />
        </AdminPageShell>
    )
}

export const getServerSideProps = getAdminServerSideProps

export default AdminMailingsEdit
