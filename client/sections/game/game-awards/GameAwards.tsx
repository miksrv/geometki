import React from 'react'
import { cn, Container, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared'
import { formatPlainDate } from '@/utils/date'

import styles from './styles.module.sass'

interface GameAwardsProps {
    awards?: ApiType.Game.LimitedAward[]
    className?: string
}

/**
 * "Награды сезона": the awards that can be earned only now — the limited achievements whose
 * dates lie within the season. Nothing but the dates ties them to it: they are ordinary
 * awards made in the admin page. A row per award: its picture | the title over what it asks
 * and until when | the visitor's progress, or a green check once earned. Renders nothing
 * without such awards.
 */
export const GameAwards: React.FC<GameAwardsProps> = ({ awards, className }) => {
    const { t } = useTranslation()

    if (!awards?.length) {
        return null
    }

    return (
        <Container
            title={t('game-awards-title')}
            className={className}
        >
            <ul className={styles.list}>
                {awards.map((award) => {
                    const percent = award.progress ? Math.min(100, Math.round(award.progress.pct)) : 0

                    return (
                        <li
                            key={award.id}
                            className={cn(styles.item, !award.earned && styles.locked)}
                        >
                            <span className={styles.icon}>
                                <AchievementIcon
                                    image={award.image}
                                    alt={''}
                                    size={44}
                                    tier={award.tier}
                                    category={award.category}
                                    group={award.group}
                                />
                            </span>

                            <div className={styles.text}>
                                <h3 className={styles.title}>{award.title}</h3>
                                {award.description && <p className={styles.description}>{award.description}</p>}

                                {award.earned ? (
                                    <p className={styles.earned}>
                                        <Icon name={'CheckCircle'} />
                                        {t('game-awards-earned')}
                                    </p>
                                ) : (
                                    <>
                                        {award.progress && (
                                            <div
                                                className={styles.bar}
                                                role={'progressbar'}
                                                aria-label={award.title}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={percent}
                                            >
                                                <div
                                                    className={styles.fill}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        )}
                                        <p className={styles.until}>
                                            {award.progress &&
                                                `${Math.min(award.progress.current, award.progress.required)} / ${award.progress.required} · `}
                                            {t('game-awards-until', { date: formatPlainDate(award.to, 'D MMMM') })}
                                        </p>
                                    </>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ul>
        </Container>
    )
}
