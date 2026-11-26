import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import {
    AdminPageShell,
    AdminTable,
    AdminTableColumn,
    AdminTitleCell,
    AdminViews,
    MAILING_STATUS_TONES,
    PaginationBar,
    StatusBadge
} from '@/components/shared'
import { useQueryFilters } from '@/hooks/useQueryFilters'
import { ADMIN_MAILINGS_HREF } from '@/utils/admin'
import { getAdminServerSideProps } from '@/utils/adminPage'
import { formatThousands } from '@/utils/helpers'
import { formatMailingDate, isMailingStatus, mailingProgress } from '@/utils/mailings'

import styles from './styles.module.sass'

type Mailing = ApiType.Mailings.MailingAdmin

const PAGE_SIZE = 20
const QUERY_KEYS = ['status', 'page'] as const
const CREATE_HREF = `${ADMIN_MAILINGS_HREF}/create`

const AdminMailingsPage: React.FC = () => {
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [query, setQuery] = useQueryFilters(QUERY_KEYS)

    // Only what the server knows goes into the request: a made-up value in the URL is no filter
    const status = isMailingStatus(query.status) ? query.status : undefined
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)

    const { data, isLoading, isFetching } = API.useMailingsGetListQuery(
        { limit: PAGE_SIZE, page, status },
        { skip: !isAuth }
    )

    const stats = data?.stats

    const createButton = () => (
        <Button
            mode={'primary'}
            size={'medium'}
            link={CREATE_HREF}
            label={t('admin-mailing-create')}
        />
    )

    const columns: Array<AdminTableColumn<Mailing>> = [
        {
            header: t('admin-mailing-subject'),
            key: 'subject',
            render: (mailing) => (
                <AdminTitleCell
                    href={`${ADMIN_MAILINGS_HREF}/${mailing.id}`}
                    title={mailing.subject}
                >
                    {mailing.author?.name}
                </AdminTitleCell>
            )
        },
        {
            header: t('admin-mailing-status'),
            key: 'status',
            render: (mailing) => (
                <StatusBadge
                    label={t(`admin-mailing-status-${mailing.status}`)}
                    tone={MAILING_STATUS_TONES[mailing.status]}
                />
            )
        },
        {
            header: t('admin-mailing-progress'),
            key: 'recipients',
            render: (mailing) => {
                if (mailing.status === 'draft') {
                    return null
                }

                const { done, recipients } = mailingProgress(mailing)

                return `${formatThousands(done)} / ${formatThousands(recipients)}`
            },
            variant: 'number'
        },
        {
            header: t('admin-mailing-date'),
            key: 'created_at',
            render: (mailing) => (
                <span className={styles.dateCell}>{formatMailingDate(mailing.sent_at ?? mailing.created_at)}</span>
            )
        }
    ]

    return (
        <AdminPageShell
            title={t('admin-mailings-title')}
            count={stats?.total ? String(stats.total) : undefined}
            actions={createButton()}
            fit={true}
        >
            <AdminViews<ApiType.Mailings.MailingStatus>
                aria-label={t('admin-mailing-status')}
                views={[
                    { count: stats?.total, key: undefined, label: t('admin-mailing-status-all') },
                    { count: stats?.draft, key: 'draft', label: t('admin-mailing-status-draft') },
                    { count: stats?.sending, key: 'sending', label: t('admin-mailing-status-sending') },
                    { count: stats?.completed, key: 'completed', label: t('admin-mailing-status-completed') },
                    { count: stats?.canceled, key: 'canceled', label: t('admin-mailing-status-canceled') }
                ]}
                active={status}
                onChange={(value) => setQuery({ page: undefined, status: value })}
            />

            <AdminTable<Mailing>
                rows={data?.items}
                columns={columns}
                loading={isLoading || (isFetching && !data?.items.length)}
                emptyTitle={t('admin-mailings-empty')}
                emptyDescription={status ? t('admin-filter-empty-description') : t('admin-mailings-empty-description')}
                emptyAction={
                    status ? (
                        <Button
                            mode={'secondary'}
                            size={'medium'}
                            label={t('admin-filter-reset')}
                            onClick={() => setQuery({ page: undefined, status: undefined })}
                        />
                    ) : (
                        createButton()
                    )
                }
            />

            <PaginationBar
                currentPage={page}
                totalItemsCount={data?.count ?? 0}
                perPage={PAGE_SIZE}
                onChangePage={(value) => setQuery({ page: value > 1 ? value : undefined })}
            />
        </AdminPageShell>
    )
}

export const getServerSideProps = getAdminServerSideProps

export default AdminMailingsPage
