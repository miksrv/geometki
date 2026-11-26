import React from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { useAppSelector } from '@/app/store'
import { SEASON_CREATE_HREF, seasonEditHref } from '@/utils/game'

import styles from './styles.module.sass'

interface SeasonAdminActionsProps {
    /** The season shown on the page: "Редактировать" leads to its form */
    seasonId?: string
    /** "Создать" (a new season), first in the line: on the game page only, where the seasons go on */
    create?: boolean
    /** What stands on the left of the line (the breadcrumbs of a season's page) */
    children?: React.ReactNode
    className?: string
}

/**
 * The line above the season card: on the left what the page puts there (the breadcrumbs), on
 * the right the administrator's buttons — edit the season, create a new one — where a list page
 * keeps "Создать". Seasons have no section in the admin: they are made on the site,
 * like quests. Nobody else sees the buttons; without them and the left side there is no line.
 */
export const SeasonAdminActions: React.FC<SeasonAdminActionsProps> = ({ seasonId, create, children, className }) => {
    const { t } = useTranslation()
    const isAdmin = useAppSelector((state) => state.auth.user?.role === 'admin')

    const buttons = isAdmin && (!!seasonId || create)

    if (!buttons && !children) {
        return null
    }

    return (
        <div className={cn(styles.line, className)}>
            {children}

            {buttons && (
                <div
                    className={styles.actions}
                    data-season-actions={true}
                >
                    {create && (
                        <Button
                            size={'medium'}
                            mode={'secondary'}
                            link={SEASON_CREATE_HREF}
                            label={t('create')}
                        />
                    )}
                    {seasonId && (
                        <Button
                            size={'medium'}
                            mode={'secondary'}
                            link={seasonEditHref(seasonId)}
                            label={t('edit')}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
