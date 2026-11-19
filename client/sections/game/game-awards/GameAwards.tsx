import React from 'react'
import { cn, Container, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { AchievementIcon } from '@/components/shared'
import { formatPlainDate } from '@/utils/date'
import { formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

interface GameAwardsProps {
    awards?: ApiType.Game.LimitedAward[]
    /** "Награды сезона" on the season's page (default), "Задания" in the side column of a profile */
    title?: string
    className?: string
}

/**
 * The awards that can be earned only now — the limited achievements running now (begun, not
 * over): "Награды сезона" on the season's page (the ones within its dates), "Задания" in the
 * side column of a profile (all running, whatever the season). Nothing but the dates ties them
 * to a season: they are ordinary awards made in the admin page. A row per award: its picture |
 * the title over what it asks, the progress — a bar for one rule, a line per rule for several
 * (never their sum) — and until when, or a green check once earned. Renders nothing without
 * such awards.
 */
export const GameAwards: React.FC<GameAwardsProps> = ({ awards, title, className }) => {
    const { t } = useTranslation()

    if (!awards?.length) {
        return null
    }

    return (
        <Container
            title={title ?? t('game-awards-title')}
            className={className}
        >
            <ul className={styles.list}>
                {awards.map((award) => {
                    const percent = award.progress ? Math.min(100, Math.round(award.progress.pct)) : 0
                    const rules = award.progress?.rules ?? []
                    const several = rules.length > 1
                    const of = (current: number, required: number) =>
                        t('user-awards-of', {
                            current: formatThousands(Math.min(current, required)),
                            required: formatThousands(required)
                        })

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
                                        {/* Several rules: a line each, the met ones green */}
                                        {several && (
                                            <ul className={styles.rules}>
                                                {rules.map((rule, index) => (
                                                    <li
                                                        key={`${rule.metric}-${index}`}
                                                        className={
                                                            rule.current >= rule.required ? styles.ruleDone : undefined
                                                        }
                                                    >
                                                        <span>{t(`achievements-metric-${rule.metric}`)}</span>
                                                        <b>{of(rule.current, rule.required)}</b>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {award.progress && !several && (
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
                                                !several &&
                                                `${of(award.progress.current, award.progress.required)} · `}
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
