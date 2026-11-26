import React, { useState } from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { ConfirmationDialog } from '@/components/shared'
import { formatDate } from '@/utils/date'
import { formatWalkDuration } from '@/utils/game'

import styles from './styles.module.sass'

interface QuestHeroActionProps {
    quest: ApiType.Game.QuestResponse
    /** "Начать квест": a walk is begun by the walker, here */
    onStart: () => void
    /** "Отказаться от квеста": a walk begun is given up, after a confirmation */
    onLeave: () => void
    busy?: boolean
}

/**
 * The cell beside the facts of the quest's head, so the head is no taller for it: before the
 * walk "Начать квест" ("Войти и начать" for a guest) over one short line — no timer, the sign-up
 * is free, or that as many quests are begun as can be —; during it how far the walk is ("2 / 6"
 * over a bar) over a quiet "Отказаться от квеста" (after a confirmation); once walked a green
 * plate "Квест пройден" with the day and, in brackets, how long the walk took (from "Начать
 * квест" to the last point: "2 д 3 ч").
 */
export const QuestHeroAction: React.FC<QuestHeroActionProps> = ({ quest, onStart, onLeave, busy }) => {
    const { t } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const [leaving, setLeaving] = useState(false)

    if (quest.walk?.finished) {
        return (
            <div className={styles.heroAction}>
                <p className={styles.finished}>
                    <Icon name={'CheckCircle'} />
                    <span>
                        <strong>{t('game-quest-walked')}</strong>
                        {`${formatDate(quest.walk.finished, 'D MMMM YYYY')} (${formatWalkDuration(
                            quest.walk.started,
                            quest.walk.finished,
                            t
                        )})`}
                    </span>
                </p>
            </div>
        )
    }

    if (!quest.walk) {
        // As many quests begun as can be: a new one waits for one of them (the server says no too)
        const atLimit = !!quest.activeWalks && quest.activeWalks.count >= quest.activeWalks.max

        // On phones "Начать квест" is the bar at the bottom: here only why it is off, if it is
        return (
            <div className={cn(styles.heroAction, !atLimit && styles.desktopOnly)}>
                <Button
                    mode={'primary'}
                    size={'large'}
                    stretched={true}
                    className={styles.desktopOnly}
                    loading={busy}
                    disabled={busy || atLimit}
                    label={t(isAuth === false ? 'game-quest-sign-in' : 'game-quest-start')}
                    onClick={onStart}
                />

                <p className={styles.heroHint}>
                    {atLimit
                        ? t('game-quest-start-limit', { count: quest.activeWalks!.max })
                        : t(isAuth === false ? 'game-quest-sign-in-note' : 'game-quest-start-note')}
                </p>
            </div>
        )
    }

    const confirmed = quest.walk.confirmed
    // A quest edited after the walk began may have fewer points than were confirmed
    const percent = quest.points ? Math.min(100, Math.round((confirmed / quest.points) * 100)) : 0

    return (
        <div className={styles.heroAction}>
            <div className={styles.heroProgress}>
                <span className={styles.heroProgressValue}>
                    {confirmed}
                    <span> / {quest.points}</span>
                </span>
                <span className={styles.progressLabel}>{t('game-quest-walk-points')}</span>
            </div>

            <div
                className={styles.bar}
                role={'progressbar'}
                aria-label={t('game-quest-walk-title')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
            >
                <div
                    className={styles.fill}
                    style={{ width: `${percent}%` }}
                />
            </div>

            <Button
                mode={'link'}
                size={'small'}
                disabled={busy}
                label={t('game-quest-leave')}
                className={styles.heroLeave}
                onClick={() => setLeaving(true)}
            />

            <ConfirmationDialog
                open={leaving}
                message={t('game-quest-leave-confirm', { title: quest.title })}
                confirmLabel={t('game-quest-leave')}
                onCancel={() => setLeaving(false)}
                onConfirm={() => {
                    setLeaving(false)
                    onLeave()
                }}
            />
        </div>
    )
}
