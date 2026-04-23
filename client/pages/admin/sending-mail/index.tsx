import React, { useCallback } from 'react'
import { Badge, Container, Table, TableColumnProps } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { SendingMailDetail } from '@/components/pages/sending-mail-detail/SendingMailDetail'
import { AppLayout, Header, UserAvatar } from '@/components/shared'
import { Pagination } from '@/components/ui'
import { SendingMailFilterPanel, SendingMailFilterType } from '@/sections/sending-mail'
import { formatDate } from '@/utils/helpers'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

import styles from './styles.module.sass'

interface AdminSendingMailPageProps {
    locale: ApiType.Locale
}

const DEFAULT_FILTERS: ApiType.SendingMail.SendingMailListRequest = {
    sort: 'created_at',
    order: 'desc',
    page: 1,
    limit: 20
}

const getStatusBadgeClass = (
    status: ApiType.SendingMail.SendingMailStatus,
    styleMap: Record<string, string>
): string => {
    switch (status) {
        case 'completed':
            return styleMap.badgeCompleted
        case 'error':
            return styleMap.badgeError
        case 'process':
            return styleMap.badgeProcess
        case 'created':
        case 'rejected':
            return styleMap.badgeDefault
    }
}

const AdminSendingMailPage: React.FC<AdminSendingMailPageProps> = () => {
    const { t, i18n } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [filters, setFilters] = React.useState<ApiType.SendingMail.SendingMailListRequest>(DEFAULT_FILTERS)
    const [selectedId, setSelectedId] = React.useState<string | null>(null)

    const { data, isLoading } = API.useGetSendingMailListQuery(filters, { skip: !isAuth })

    const pageTitle = t('sending-mail-admin-title')

    const sortFieldMap: Partial<
        Record<keyof ApiType.SendingMail.SendingMailItem, ApiType.SendingMail.SendingMailListRequest['sort']>
    > = {
        created: 'created_at',
        updated: 'updated_at',
        status: 'status'
    }

    const handleSortChange = (field: keyof ApiType.SendingMail.SendingMailItem) => {
        const sortField = sortFieldMap[field] ?? 'created_at'
        setFilters((prev) => ({
            ...prev,
            sort: sortField,
            order: prev.sort === sortField && prev.order === 'asc' ? 'desc' : 'asc',
            page: 1
        }))
    }

    const handleFilterChange = useCallback((key: keyof SendingMailFilterType, value: string | undefined) => {
        setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }))
    }, [])

    const columns: Array<TableColumnProps<ApiType.SendingMail.SendingMailItem>> = [
        {
            accessor: 'status',
            header: t('sending-mail-admin-col-status'),
            isSortable: true,
            onChangeSort: ({ key }) => handleSortChange(key),
            formatter: (_, sortedData, rowIndex) => {
                const item = sortedData[rowIndex]
                return (
                    <Badge
                        label={t(`sending-mail-status-${item.status}`)}
                        className={getStatusBadgeClass(item.status, styles)}
                        size={'small'}
                    />
                )
            }
        },
        {
            accessor: 'user',
            header: t('sending-mail-admin-col-user'),
            formatter: (_, sortedData, rowIndex) => {
                return (
                    <UserAvatar
                        size={'medium'}
                        showName={true}
                        user={sortedData[rowIndex].user}
                        caption={sortedData[rowIndex].email}
                    />
                )
            }
        },
        {
            accessor: 'subject',
            header: t('sending-mail-admin-col-subject'),
            formatter: (_, sortedData, rowIndex) => {
                const { subject, activity } = sortedData[rowIndex]
                if (subject) {
                    return <span>{subject.length > 50 ? `${subject.slice(0, 50)}…` : subject}</span>
                }
                if (activity?.type) {
                    return (
                        <Badge
                            label={t(`notification_${activity.type}`)}
                            className={styles.badgeDefault}
                            size={'small'}
                        />
                    )
                }
                return <span>—</span>
            }
        },
        {
            accessor: 'updated',
            header: t('sending-mail-admin-col-processed-at'),
            isSortable: true,
            onChangeSort: ({ key }) => handleSortChange(key),
            formatter: (_, sortedData, rowIndex) => {
                const item = sortedData[rowIndex]
                return item.status !== 'created' ? formatDate(item.updated?.date, 'D.M.YYYY, HH:mm') : ''
            }
        },
        {
            accessor: 'created',
            header: t('sending-mail-admin-col-created-at'),
            isSortable: true,
            onChangeSort: ({ key }) => handleSortChange(key),
            formatter: (_, sortedData, rowIndex) => (
                <span
                    className={styles.clickableCell}
                    onClick={() => setSelectedId(sortedData[rowIndex].id)}
                >
                    {formatDate(sortedData[rowIndex].created?.date, 'D.M.YYYY, HH:mm')}
                </span>
            )
        }
    ]

    return (
        <AppLayout>
            <NextSeo
                title={pageTitle}
                noindex={true}
                openGraph={{
                    locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                    title: pageTitle
                }}
            />

            <Header
                title={pageTitle}
                homePageTitle={t('geotags')}
                currentPage={pageTitle}
            />

            <Container style={{ padding: '10px' }}>
                <SendingMailFilterPanel
                    status={filters.status}
                    email={filters.email}
                    onChange={handleFilterChange}
                />
            </Container>

            <Container>
                <Table
                    data={data?.items ?? []}
                    columns={columns}
                    loading={isLoading}
                    noDataCaption={t('sending-mail-admin-no-data')}
                    stickyHeader
                />
            </Container>

            <Container className={'paginationContainer'}>
                <div>
                    {t('sending-mail-admin-total')} <strong>{data?.count}</strong>
                </div>

                <Pagination
                    currentPage={filters.page ?? 1}
                    totalItemsCount={data?.count ?? 0}
                    perPage={20}
                    captionPage={t('page')}
                    captionNextPage={t('next-page')}
                    captionPrevPage={t('prev-page')}
                    hideIfOnePage={true}
                    onChangePage={(page) => setFilters((prev) => ({ ...prev, page }))}
                />
            </Container>

            <SendingMailDetail
                id={selectedId}
                onClose={() => setSelectedId(null)}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<AdminSendingMailPageProps>> => {
            const locale = (context.locale ?? 'ru') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            store.dispatch(setLocale(locale))
            hydrateAuthFromCookies(store, context.req.cookies)

            const { data: authData } = await store.dispatch(API.endpoints.authGetMe.initiate())

            if (authData?.user?.role !== 'admin') {
                return { notFound: true }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    locale
                }
            }
        }
)

export default AdminSendingMailPage
