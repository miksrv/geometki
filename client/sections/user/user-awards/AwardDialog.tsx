import React, { useMemo } from 'react'
import { Button, Dialog, Skeleton } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { AchievementIcon } from '@/components/shared'
import { StatTiles } from '@/components/ui'
import { groupAchievements } from '@/utils/achievements'
import { formatPlainDate } from '@/utils/date'
import { formatDate, formatThousands } from '@/utils/helpers'

import { AwardPicture, LockedMedal } from './AwardButton'
import { Award } from './useUserAwards'

import styles from './styles.module.sass'

/** The picture of the card: the medal as large as the dialog allows */
const PICTURE_SIZE = 168

/** The medal of a step in the list of steps */
const STEP_SIZE = 52

interface AwardDialogProps {
    award: Award
    /** Over the dialog of every award: no overlay of its own, the one under it is dimmed */
    stacked?: boolean
    onClose: () => void
}

/**
 * The card of one award: the medal, what it is and when it came; an achievement — its
 * description, the count the person has and its steps (what each asks, when it came); a season
 * and a quest lead to their pages.
 */
export const AwardDialog: React.FC<AwardDialogProps> = ({ award, stacked, onClose }) => {
    const { t } = useTranslation()

    return (
        <Dialog
            open={true}
            title={award.title}
            maxWidth={'460px'}
            showOverlay={!stacked}
            showCloseButton={true}
            contentClassName={styles.dialogBody}
            onCloseDialog={onClose}
        >
            <div className={styles.card}>
                <div className={styles.cardPicture}>
                    <AwardPicture
                        award={award}
                        size={PICTURE_SIZE}
                    />
                </div>

                {award.kind === 'season' && <SeasonFacts award={award} />}
                {award.kind === 'quest' && <QuestFacts award={award} />}
                {award.kind === 'achievement' && <AchievementFacts award={award} />}

                {award.href && (
                    <Button
                        mode={'secondary'}
                        stretched={true}
                        // A link button: the kit stretches the button, not the link around it
                        style={{ width: '100%' }}
                        link={award.href}
                        label={t(award.kind === 'season' ? 'user-awards-open-season' : 'user-awards-open-quest')}
                    />
                )}
            </div>
        </Dialog>
    )
}

/** "1 сентября — 30 ноября 2026"; a season across the new year names both years */
const seasonDates = (from?: string, to?: string): string | undefined =>
    from && to
        ? `${formatPlainDate(from, from.slice(0, 4) === to.slice(0, 4) ? 'D MMMM' : 'D MMMM YYYY')} — ${formatPlainDate(to, 'D MMMM YYYY')}`
        : undefined

const SeasonFacts: React.FC<{ award: Award }> = ({ award }) => {
    const { t } = useTranslation()
    const season = award.season!

    return (
        <>
            <p className={styles.cardKind}>
                {t('user-awards-kind-season')}
                {' · '}
                {season.closed ? seasonDates(season.from, season.to) : t('user-awards-season-running')}
            </p>
            <StatTiles
                className={styles.cardFacts}
                aria-label={season.title}
                items={[
                    ...(season.place
                        ? [{ key: 'place', label: t('user-side-game-place'), value: String(season.place) }]
                        : []),
                    { key: 'points', label: t('user-side-game-points'), value: formatThousands(season.points) },
                    { key: 'places', label: t('user-awards-season-places'), value: formatThousands(season.places) }
                ]}
            />
        </>
    )
}

const QuestFacts: React.FC<{ award: Award }> = ({ award }) => {
    const { t } = useTranslation()
    const quest = award.quest!

    return (
        <>
            <p className={styles.cardKind}>
                {t('user-awards-kind-quest')}
                {quest.walk?.finished &&
                    ` · ${t('user-side-awards-quest-walked', { date: formatDate(quest.walk.finished, 'D MMMM YYYY') })}`}
            </p>
            {quest.description && <p className={styles.cardDescription}>{quest.description}</p>}
        </>
    )
}

const AchievementFacts: React.FC<{ award: Award }> = ({ award }) => {
    const { t } = useTranslation()

    // The list of a profile counts nothing: the card asks for its achievement, every step with the progress
    const { data, isFetching } = API.useGetUserAchievementGroupQuery(
        { group: award.group!.key, userId: award.userId ?? '' },
        { skip: !award.userId }
    )
    const counted = useMemo(() => (data?.data.length ? groupAchievements(data.data)[0] : undefined), [data])
    const loading = !counted && isFetching

    const { achieved, next, steps, passed } = counted ?? award.group!
    // What to do now: the next step's text ("Создайте 25 мест и посетите 50"), the last one's when all are passed
    const shown = next ?? achieved ?? steps[0]
    const tierName = (tier: string) => t(`achievements-tier-${tier}`)
    const single = steps.length === 1
    // The person's real counts, the same for every step; the steps differ only by their thresholds
    const progress = steps[steps.length - 1].progress
    const rules = progress?.rules ?? []
    // Several rules are never summed: each is shown apart, against what the next step asks of it
    const several = rules.length > 1
    const count = rules[0]?.current ?? progress?.current ?? 0
    const required = (step: (typeof steps)[number]) =>
        step.progress?.rules?.length
            ? step.progress.rules.map((rule) => formatThousands(rule.required)).join(' · ')
            : step.progress
              ? formatThousands(step.progress.required)
              : undefined

    // The day a step came; one passed by jumping over it (the server awards the higher step alone)
    // came with the first higher step awarded, and has its day
    const stepDate = (index: number): string | undefined => {
        if (index >= passed) {
            return undefined
        }

        const earned = steps.slice(index).find((step) => step.earned_at)?.earned_at

        return earned ? formatDate(earned.date, 'D MMM YYYY') : t('user-awards-step-passed')
    }

    return (
        <>
            {/* The count is being counted: its place kept, the card does not jump */}
            {loading && <Skeleton className={styles.countLoader} />}

            {/* What the person has, large, right under the medal: each step below says what it asks;
                one without steps — of how many */}
            {progress && !several && (
                <p className={styles.cardCount}>
                    {single && !achieved
                        ? t('user-awards-of', {
                              current: formatThousands(count),
                              required: formatThousands(progress.required)
                          })
                        : formatThousands(count)}
                </p>
            )}

            {shown.description && <p className={styles.cardDescription}>{shown.description}</p>}

            {/* No steps: the day it came has no step medal to stand by, it goes here */}
            {single && achieved?.earned_at && (
                <p className={styles.cardMeta}>
                    {t('achievements-earned-at', { date: formatDate(achieved.earned_at.date, 'D MMMM YYYY') })}
                </p>
            )}

            {/* Several rules: a row each — the metric, the count and, until all are passed, what the next step asks */}
            {several && (
                <ul className={styles.rules}>
                    {rules.map((rule, index) => {
                        const target = next?.progress?.rules?.[index]?.required
                        const done = target !== undefined && rule.current >= target

                        return (
                            <li
                                key={`${rule.metric}-${index}`}
                                className={done ? styles.ruleDone : undefined}
                            >
                                <span className={styles.ruleName}>{t(`achievements-metric-${rule.metric}`)}</span>
                                <strong>
                                    {target !== undefined
                                        ? t('user-awards-of', {
                                              current: formatThousands(rule.current),
                                              required: formatThousands(target)
                                          })
                                        : formatThousands(rule.current)}
                                </strong>
                            </li>
                        )
                    })}
                </ul>
            )}

            {/* The steps: the medal of each (under a lock until passed), what it asks and when it came */}
            {!single && (
                <ol
                    className={styles.steps}
                    aria-label={t('achievements-steps', { passed, total: steps.length })}
                >
                    {steps.map((step, index) => {
                        const medal = (
                            <AchievementIcon
                                image={step.image}
                                alt={''}
                                size={STEP_SIZE}
                                tier={step.tier}
                                category={step.type === 'seasonal' ? 'seasonal' : undefined}
                                group={step.group_slug}
                            />
                        )

                        return (
                            <li
                                key={step.id}
                                className={styles.step}
                                aria-label={`${tierName(step.tier)}: ${step.description}`}
                                title={step.description}
                            >
                                {index < passed ? medal : <LockedMedal size={STEP_SIZE}>{medal}</LockedMedal>}
                                <span className={styles.stepText}>
                                    {/* Several rules: their thresholds in the order of the rows above */}
                                    {required(step) && <span className={styles.stepRequired}>{required(step)}</span>}
                                    <span className={styles.stepDate}>
                                        {stepDate(index) ?? t('user-awards-step-locked')}
                                    </span>
                                </span>
                            </li>
                        )
                    })}
                </ol>
            )}
        </>
    )
}
