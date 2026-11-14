import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { AchievementIcon } from '@/components/shared/achievement-icon'
import { AchievementGroup } from '@/utils/achievements'
import { formatDate, formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

interface AchievementRowProps {
    group: AchievementGroup
}

/**
 * One achievement as a low row across the list: the medal of the highest step passed (the first
 * one, faded and grey, before it) | the title with its category, and where the person is (the
 * tier and the day it came, or "not earned yet") | what the next step asks with the progress to
 * it and the experience it gives (or "all steps passed") | the steps as tier dots.
 */
export const AchievementRow: React.FC<AchievementRowProps> = ({ group }) => {
    const { t } = useTranslation()

    const { achieved, next, steps, passed, category } = group
    const shown = achieved ?? next ?? steps[0]
    const progress = next?.progress
    const percent = progress ? Math.min(100, Math.max(0, Math.round(progress.pct))) : 0
    const tierName = (tier: string) => t(`achievements-tier-${tier}`)
    const earnedDate = achieved?.earned_at ? formatDate(achieved.earned_at.date, 'D MMMM YYYY') : undefined

    return (
        <li className={cn(styles.row, !achieved && styles.locked)}>
            <span className={styles.medalIcon}>
                <AchievementIcon
                    image={shown.image}
                    alt={''}
                    size={48}
                    tier={shown.tier}
                    category={shown.category}
                    group={shown.group_slug}
                />
            </span>

            <div className={styles.who}>
                <h3 className={styles.title}>{shown.title}</h3>
                <p className={styles.meta}>
                    <span>{t(`achievements-category-${category}`)}</span>
                    <span>
                        {earnedDate
                            ? achieved?.tier === 'none'
                                ? t('achievements-earned-at', { date: earnedDate })
                                : t('achievements-tier-earned', { date: earnedDate, tier: tierName(achieved!.tier) })
                            : t('achievements-not-yet')}
                    </span>
                </p>
            </div>

            <div className={styles.goal}>
                {next ? (
                    <>
                        <div className={styles.goalRow}>
                            <span
                                className={styles.goalText}
                                title={next.description}
                            >
                                {next.description}
                            </span>
                            {progress && (
                                <span className={styles.goalValue}>
                                    {`${formatThousands(Math.min(progress.current, progress.required))} / ${formatThousands(progress.required)}`}
                                </span>
                            )}
                        </div>
                        {progress && (
                            <div
                                className={styles.bar}
                                role={'progressbar'}
                                aria-label={
                                    next.tier === 'none'
                                        ? t('achievements-progress')
                                        : t('achievements-next-step', { tier: tierName(next.tier) })
                                }
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={percent}
                            >
                                <div
                                    className={cn(styles.fill, styles[`tier-${next.tier}`])}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <p className={styles.done}>
                        <Icon name={'CheckCircle'} />
                        {t('achievements-all-passed')}
                    </p>
                )}
            </div>

            {steps.length > 1 && (
                <ol
                    className={styles.steps}
                    aria-label={t('achievements-steps', { passed, total: steps.length })}
                >
                    {steps.map((step, index) => {
                        const label = `${tierName(step.tier)}${step.xp_bonus > 0 ? ` · ${t('achievements-step-xp', { xp: formatThousands(step.xp_bonus) })}` : ''}`

                        return (
                            <li
                                key={step.id}
                                className={cn(
                                    styles.step,
                                    index < passed && styles.passed,
                                    styles[`tier-${step.tier}`]
                                )}
                                title={label}
                            >
                                <span className={styles.srOnly}>{label}</span>
                            </li>
                        )
                    })}
                </ol>
            )}
        </li>
    )
}
