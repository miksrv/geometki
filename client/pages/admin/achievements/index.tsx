import React from 'react'
import { Badge, Button, cn, Container, Table, TableColumnProps } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import Link from 'next/link'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AppLayout, ConfirmationDialog, Header } from '@/components/shared'
import { AchievementTierBadge } from '@/components/shared/achievement-card/AchievementTierBadge'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { formatDate } from '@/utils/helpers'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

import styles from './styles.module.sass'

interface AdminAchievementsPageProps {
    locale: ApiType.Locale
}

const AdminAchievementsPage: React.FC<AdminAchievementsPageProps> = () => {
    const { t, i18n } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data, isLoading } = API.useGetAchievementsManageQuery(undefined, { skip: !isAuth })
    const [deleteAchievement] = API.useDeleteAchievementMutation()

    const achievements = data?.data ?? []

    const [deleteTarget, setDeleteTarget] = React.useState<ApiType.Achievements.AchievementAdmin | null>(null)

    const handleDelete = async () => {
        if (!deleteTarget) {
            return
        }
        await deleteAchievement(deleteTarget.id)
            .unwrap()
            .catch(() => undefined)
        setDeleteTarget(null)
    }

    const pageTitle = t('achievements-admin-title')

    const columns: Array<TableColumnProps<ApiType.Achievements.AchievementAdmin>> = [
        {
            accessor: 'image',
            header: '',
            className: styles.imageCell,
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return (
                    <AchievementIcon
                        image={achievement.image}
                        alt={achievement.title}
                        size={24}
                    />
                )
            }
        },
        {
            accessor: 'title',
            header: t('achievements-admin-name'),
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return (
                    <div className={styles.titleCell}>
                        <Link href={`/admin/achievements/${String(achievement.id)}`}>{achievement.title}</Link>
                        {achievement.description && (
                            <span className={styles.titleDescription}>{achievement.description}</span>
                        )}
                        {achievement.season_start && achievement.season_end && (
                            <span className={cn(styles.titleDescription, styles.titleDate)}>
                                {formatDate(achievement.season_start, 'D MMM YYYY')}
                                {' – '}
                                {formatDate(achievement.season_end, 'D MMM YYYY')}
                            </span>
                        )}
                    </div>
                )
            }
        },
        {
            accessor: 'tier',
            header: t('achievements-admin-tier'),
            formatter: (_, sortedData, rowIndex) => (
                <AchievementTierBadge
                    tier={sortedData[rowIndex].tier}
                    t={t}
                />
            )
        },
        {
            accessor: 'type',
            header: t('achievements-admin-type'),
            formatter: (_, sortedData, rowIndex) => (
                <Badge
                    size={'small'}
                    label={t(`achievements-${String(sortedData[rowIndex].type)}`)}
                    className={styles.typeBadge}
                />
            )
        },
        {
            accessor: 'category',
            header: t('achievements-admin-category'),
            formatter: (_, sortedData, rowIndex) => t(`achievements-category-${String(sortedData[rowIndex].category)}`)
        },
        {
            accessor: 'id',
            header: '',
            formatter: (_, sortedData, rowIndex) => (
                <Button
                    icon={'Close'}
                    variant={'negative'}
                    size={'small'}
                    className={`${styles.actionBtn} ${styles.danger}`}
                    onClick={() => setDeleteTarget(sortedData[rowIndex])}
                />
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
                actions={
                    <Button
                        mode={'primary'}
                        size={'medium'}
                        link={'/admin/achievements/create'}
                    >
                        {t('achievements-admin-add')}
                    </Button>
                }
            />

            <Container>
                <Table
                    data={achievements}
                    columns={columns}
                    loading={isLoading}
                    noDataCaption={t('achievements-noAchievements')}
                    stickyHeader
                />
            </Container>

            <ConfirmationDialog
                open={!!deleteTarget}
                message={t('achievements-admin-delete-confirm')}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<AdminAchievementsPageProps>> => {
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

export default AdminAchievementsPage
