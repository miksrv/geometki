import React, { CSSProperties } from 'react'
import { Badge, Button, Container, Dialog, Icon, Table, TableColumnProps } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import Link from 'next/link'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AppLayout, Header } from '@/components/shared'
import { AchievementTierBadge } from '@/components/shared/achievement-card/AchievementTierBadge'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { TIER_COLORS } from '@/utils/achievements'
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
            accessor: 'icon',
            header: '',
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                const tierColor = TIER_COLORS[achievement.tier]
                const cssVars = { '--tier-color': tierColor } as CSSProperties

                return (
                    <div
                        className={styles.iconCell}
                        style={cssVars}
                    >
                        <AchievementIcon
                            image={achievement.image}
                            icon={achievement.icon}
                            alt={achievement.title}
                            size={18}
                            style={{ borderRadius: '50%' }}
                        />
                    </div>
                )
            }
        },
        {
            accessor: 'title',
            header: t('achievements-admin-title'),
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return <strong>{achievement.title}</strong>
            }
        },
        {
            accessor: 'tier',
            header: t('achievements-admin-tier'),
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return (
                    <AchievementTierBadge
                        tier={achievement.tier}
                        t={t}
                    />
                )
            }
        },
        {
            accessor: 'type',
            header: t('achievements-admin-type'),
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return (
                    <Badge
                        size={'small'}
                        label={t(`achievements-${String(achievement.type)}`)}
                        className={styles.typeBadge}
                    />
                )
            }
        },
        {
            accessor: 'category',
            header: t('achievements-admin-category'),
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return <>{t(`achievements-category-${String(achievement.category)}`)}</>
            }
        },
        {
            accessor: 'season_start',
            header: t('achievements-admin-season-dates'),
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return (
                    <>
                        {achievement.season_start && achievement.season_end
                            ? `${String(achievement.season_start)} – ${String(achievement.season_end)}`
                            : '—'}
                    </>
                )
            }
        },
        {
            accessor: 'id',
            header: '',
            formatter: (_, sortedData, rowIndex) => {
                const achievement = sortedData[rowIndex]
                return (
                    <div className={styles.actionsCell}>
                        <Link
                            className={styles.actionBtn}
                            href={`/admin/achievements/${String(achievement.id)}`}
                            title={t('edit')}
                        >
                            <Icon name={'Pencil'} />
                        </Link>
                        <button
                            className={`${styles.actionBtn} ${styles.danger}`}
                            onClick={() => setDeleteTarget(achievement)}
                            title={t('delete')}
                        >
                            <Icon name={'Close'} />
                        </button>
                    </div>
                )
            }
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

            <Dialog
                open={!!deleteTarget}
                title={t('achievements-admin-delete-confirm')}
                showCloseButton
                onCloseDialog={() => setDeleteTarget(null)}
            >
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
                    <Button
                        mode={'secondary'}
                        size={'medium'}
                        onClick={() => setDeleteTarget(null)}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        mode={'primary'}
                        size={'medium'}
                        onClick={handleDelete}
                    >
                        {t('delete')}
                    </Button>
                </div>
            </Dialog>
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
