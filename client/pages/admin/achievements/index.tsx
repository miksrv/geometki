import React from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import {
    ACHIEVEMENT_TYPE_TONES,
    AchievementIcon,
    AdminPageShell,
    AdminTable,
    AdminTableColumn,
    AdminTitleCell,
    AdminViews,
    StatusBadge
} from '@/components/shared'
import { AchievementTierBadge } from '@/components/shared/achievement-tier-badge'
import { useQueryFilters } from '@/hooks/useQueryFilters'
import { AchievementFilter, AchievementFilterPanel, filterAchievements } from '@/sections/admin/achievement-filter'
import { ACHIEVEMENTS_ADMIN_HREF } from '@/sections/admin/achievement-form'
import { getAdminServerSideProps } from '@/utils/adminPage'
import { formatDate, formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

type Achievement = ApiType.Achievements.AchievementAdmin

const ACHIEVEMENTS_CREATE_HREF = `${ACHIEVEMENTS_ADMIN_HREF}/create`

/** The filters live in the URL: a filtered list survives a reload, "back" from a form and a shared link */
const FILTER_KEYS = ['state', 'type', 'query'] as const

type StateView = 'on' | 'off'

const AdminAchievementsPage: React.FC = () => {
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data, isError, isLoading } = API.useGetAchievementsManageQuery(undefined, { skip: !isAuth })

    const [filter, setFilter] = useQueryFilters(FILTER_KEYS)
    const rows = React.useMemo(() => filterAchievements(data?.data, filter), [data, filter])
    const filtered = !!(filter.state || filter.type || filter.query)

    const handleFilterChange = React.useCallback(
        (key: keyof AchievementFilter, value: string | undefined) => setFilter({ [key]: value }),
        [setFilter]
    )

    // The counts of the views are of the list narrowed by the other filters: a view never promises rows it has not
    const countOf = (state?: StateView) => filterAchievements(data?.data, { ...filter, state })?.length

    // A switched-off award is muted in every cell; the "Выключено" badge says why
    const cell = (achievement: Achievement, content: React.ReactNode) => (
        <span className={cn(!achievement.is_active && styles.muted)}>{content}</span>
    )

    const createButton = () => (
        <Button
            mode={'primary'}
            size={'medium'}
            link={ACHIEVEMENTS_CREATE_HREF}
            label={t('achievements-admin-add')}
        />
    )

    const columns: Array<AdminTableColumn<Achievement>> = [
        {
            header: '',
            key: 'image',
            render: (achievement) =>
                cell(
                    achievement,
                    <AchievementIcon
                        image={achievement.image}
                        alt={''}
                        size={24}
                        tier={achievement.tier}
                        category={achievement.type === 'seasonal' ? 'seasonal' : undefined}
                        group={achievement.group_slug}
                    />
                ),
            variant: 'image'
        },
        {
            header: t('achievements-admin-name'),
            key: 'title',
            // The title stays readable beside its "Выключено" badge; the other cells step back
            render: (achievement) => (
                <AdminTitleCell
                    href={`${ACHIEVEMENTS_ADMIN_HREF}/${achievement.id}`}
                    title={achievement.title}
                    badge={
                        achievement.is_active ? undefined : (
                            <StatusBadge
                                label={t('achievements-admin-inactive')}
                                tone={'warning'}
                            />
                        )
                    }
                >
                    {[
                        achievement.description,
                        achievement.season_start &&
                            achievement.season_end &&
                            `${formatDate(achievement.season_start, 'D MMM YYYY')} – ${formatDate(achievement.season_end, 'D MMM YYYY')}`
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </AdminTitleCell>
            )
        },
        {
            header: t('achievements-admin-tier'),
            key: 'tier',
            render: (achievement) => (
                <AchievementTierBadge
                    tier={achievement.tier}
                    t={t}
                />
            )
        },
        {
            header: t('achievements-admin-type'),
            key: 'type',
            render: (achievement) => (
                <StatusBadge
                    label={t(`achievements-${achievement.type}`)}
                    tone={ACHIEVEMENT_TYPE_TONES[achievement.type]}
                />
            )
        },
        {
            header: t('achievements-admin-holders'),
            key: 'holders',
            render: (achievement) => cell(achievement, formatThousands(achievement.holders ?? 0)),
            variant: 'number'
        }
    ]

    return (
        <AdminPageShell
            title={t('achievements-admin-title')}
            count={data?.data.length ? String(data.data.length) : undefined}
            actions={createButton()}
            fit={true}
        >
            <AdminViews<StateView>
                aria-label={t('achievements-admin-view-label')}
                views={[
                    { count: countOf(), key: undefined, label: t('achievements-admin-view-all') },
                    { count: countOf('on'), key: 'on', label: t('admin-widget-achievements-active') },
                    { count: countOf('off'), key: 'off', label: t('admin-widget-achievements-off') }
                ]}
                active={filter.state === 'on' || filter.state === 'off' ? filter.state : undefined}
                onChange={(state) => setFilter({ state })}
            />

            <AchievementFilterPanel
                filter={filter}
                onChange={handleFilterChange}
            />

            <AdminTable<Achievement>
                rows={rows}
                columns={columns}
                loading={isLoading}
                error={isError ? t('admin-widget-error') : undefined}
                emptyTitle={filtered ? t('achievements-admin-filter-empty') : t('achievements-noAchievements')}
                emptyDescription={
                    filtered ? t('admin-filter-empty-description') : t('achievements-admin-empty-description')
                }
                emptyAction={
                    filtered ? (
                        <Button
                            mode={'secondary'}
                            size={'medium'}
                            label={t('admin-filter-reset')}
                            onClick={() => setFilter({ query: undefined, state: undefined, type: undefined })}
                        />
                    ) : (
                        createButton()
                    )
                }
            />
        </AdminPageShell>
    )
}

export const getServerSideProps = getAdminServerSideProps

export default AdminAchievementsPage
