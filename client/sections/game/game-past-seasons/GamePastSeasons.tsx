import React from 'react'
import { Container } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { AchievementIcon, UserAvatarGroup } from '@/components/shared'
import { formatPlainDate } from '@/utils/date'
import { seasonHref } from '@/utils/game'

import styles from './styles.module.sass'

interface GamePastSeasonsProps {
    seasons: ApiType.Game.GetResponse['seasons']
    className?: string
}

/**
 * "Прошлый сезон": a card of the game page's side column, under the season's awards — always
 * the last closed season (the API sends only it), one low row: the season's picture | its name
 * and dates | the podium's faces; the row is a link to the season's page with its frozen
 * table. Renders nothing before the first season is over.
 */
export const GamePastSeasons: React.FC<GamePastSeasonsProps> = ({ seasons, className }) => {
    const { t } = useTranslation()
    const season = seasons[0]

    if (!season) {
        return null
    }

    return (
        <Container
            title={t('game-past-title')}
            className={className}
        >
            <div className={styles.row}>
                <AchievementIcon
                    image={season.image}
                    alt={''}
                    size={40}
                    category={'seasonal'}
                    group={`season-${season.id}`}
                />

                <div className={styles.who}>
                    <h3 className={styles.title}>
                        <Link
                            href={seasonHref(season.id, season.slug)}
                            className={styles.link}
                        >
                            {season.title}
                        </Link>
                    </h3>
                    <p className={styles.meta}>
                        {formatPlainDate(season.from, 'D MMMM')} — {formatPlainDate(season.to, 'D MMMM YYYY')}
                    </p>
                </div>

                <UserAvatarGroup users={season.winners.map(({ user }) => user)} />
            </div>
        </Container>
    )
}
