import React, { useState } from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { PhotoLightbox, PlaceCard } from '@/components/shared'
import { IMG_HOST } from '@/config/env'
import { formatDate } from '@/utils/date'
import { isSecretMode, walkingDirectionsHref } from '@/utils/game'

import styles from './styles.module.sass'

interface QuestStepsProps {
    quest: ApiType.Game.QuestResponse
    /**
     * Given once the walk is begun: "Я здесь" for any point of an open quest (with its id), "Я на
     * точке N" / "Я на месте" for the current point of a step or riddle quest (without one)
     */
    onConfirm?: (pointId?: string) => void
    busy?: boolean
}

const CHECK = (
    <svg
        viewBox={'0 0 10 10'}
        aria-hidden={true}
        focusable={false}
    >
        <path d={'M2.2 5.2l1.9 1.9 3.7-3.9'} />
    </svg>
)

/**
 * The points of a quest as a timeline: the numbered mark of each point (the same as on the
 * map: a green check when confirmed, filled for the one to go to, outlined for the rest, a lock
 * for a closed one) on a line, and what the walker may see of it — the place as a `PlaceCard`
 * row with its hint, the riddle of the current point, or nothing but "opens after point N". Under a place only
 * what the walk needs: the day it was confirmed, "Я здесь" (open), the actions of the current
 * point. A quest is no part of a season; a confirmed point is a confirmed visit like any other.
 * No distances between the points: the quest's length is in its head, the way to the current
 * point is "Проложить путь".
 * During the walk the current point is where it is walked: "Я на месте" with "Проложить путь"
 * on a step quest, "Я на месте" under the riddle — a text, or a photo quest's photo (the first
 * photo of the place, whole, enlarged in the viewer on a tap); any point of an open quest has its own. On
 * phones none of them: the one "Я на месте" is the bar at the bottom of the screen.
 */
export const QuestSteps: React.FC<QuestStepsProps> = ({ quest, onConfirm, busy }) => {
    const { t, i18n } = useTranslation()

    const points = quest.items
    const finished = !!quest.walk?.finished
    // A photo quest's riddle in the viewer
    const [zoomed, setZoomed] = useState<ApiModel.PhotoMark[]>()

    return (
        <>
            <ol className={styles.steps}>
                {points.map((point, index) => {
                    const riddle = isSecretMode(quest.mode) && point.state === 'current'
                    // The line to the next point, as on the map: green between two confirmed points,
                    // blue to one still ahead, grey to a closed one
                    const next = points[index + 1]
                    const line = !next
                        ? undefined
                        : point.state === 'done' && next.state === 'done'
                          ? styles.lineDone
                          : next.state === 'locked'
                            ? styles.lineLocked
                            : undefined
                    // The point to confirm now, on a quest walked in order
                    const now = !!onConfirm && !finished && quest.mode !== 'open' && point.state === 'current'

                    return (
                        <li
                            key={point.id}
                            className={cn(styles.step, styles[point.state], line)}
                        >
                            <div
                                className={styles.rail}
                                aria-hidden={true}
                            >
                                <span className={styles.mark}>
                                    {point.state === 'done' ? (
                                        CHECK
                                    ) : point.state === 'locked' ? (
                                        <Icon name={'Lock'} />
                                    ) : (
                                        point.position
                                    )}
                                </span>
                            </div>

                            <div className={styles.stepBody}>
                                {point.place ? (
                                    <div className={styles.point}>
                                        <PlaceCard
                                            place={point.place}
                                            variant={'row'}
                                            headingLevel={3}
                                            footer={point.hint && <p className={styles.hint}>{point.hint}</p>}
                                        />

                                        {point.state === 'done' ? (
                                            <div className={styles.pointState}>
                                                <span className={styles.confirmed}>
                                                    <Icon name={'CheckCircle'} />
                                                    {t('game-quest-point-done', {
                                                        date: formatDate(point.confirmedAt, 'D MMMM')
                                                    })}
                                                </span>
                                            </div>
                                        ) : quest.mode === 'open' && onConfirm && !finished ? (
                                            // On phones the one "Я на месте" is the bar at the bottom
                                            <div className={cn(styles.pointState, styles.desktopOnly)}>
                                                <Button
                                                    mode={'secondary'}
                                                    size={'small'}
                                                    icon={'Position'}
                                                    disabled={busy}
                                                    label={t('game-here-button')}
                                                    className={styles.pointActions}
                                                    onClick={() => onConfirm(point.id)}
                                                />
                                            </div>
                                        ) : (
                                            now && (
                                                <div className={styles.pointState}>
                                                    <div className={styles.pointActions}>
                                                        {/* In a new tab: the quest stays open behind the navigator (the kit's
                                                        link button has no target) */}
                                                        <a
                                                            href={walkingDirectionsHref(
                                                                point.place.lat,
                                                                point.place.lon,
                                                                i18n.language
                                                            )}
                                                            target={'_blank'}
                                                            rel={'noopener noreferrer nofollow'}
                                                            className={styles.directions}
                                                        >
                                                            <Button
                                                                mode={'secondary'}
                                                                size={'small'}
                                                                icon={'Map'}
                                                                tabIndex={-1}
                                                                label={t('game-quest-directions')}
                                                            />
                                                        </a>
                                                        <Button
                                                            mode={'primary'}
                                                            size={'small'}
                                                            icon={'Position'}
                                                            loading={busy}
                                                            disabled={busy}
                                                            label={t('game-here-button')}
                                                            className={styles.desktopOnly}
                                                            onClick={() => onConfirm?.()}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ) : riddle ? (
                                    <div className={styles.riddle}>
                                        <span className={styles.riddleLabel}>
                                            {t(quest.mode === 'photos' ? 'game-quest-photo' : 'game-quest-riddle', {
                                                number: point.position
                                            })}
                                        </span>
                                        {quest.mode !== 'photos' ? (
                                            <p className={styles.riddleText}>
                                                {point.hint ?? t('game-quest-riddle-empty')}
                                            </p>
                                        ) : point.photo ? (
                                            <button
                                                type={'button'}
                                                className={styles.riddlePhoto}
                                                // The photo whole, in its own proportions
                                                style={
                                                    point.photo.width && point.photo.height
                                                        ? {
                                                              aspectRatio: `${point.photo.width} / ${point.photo.height}`
                                                          }
                                                        : undefined
                                                }
                                                aria-label={t('game-quest-photo-zoom')}
                                                onClick={() =>
                                                    setZoomed([
                                                        {
                                                            full: point.photo!.full,
                                                            height: point.photo!.height,
                                                            preview: point.photo!.preview,
                                                            title: t('game-quest-photo', { number: point.position }),
                                                            width: point.photo!.width
                                                        } as ApiModel.PhotoMark
                                                    ])
                                                }
                                            >
                                                <Image
                                                    src={`${IMG_HOST}${point.photo.full}`}
                                                    alt={''}
                                                    fill
                                                    sizes={'(max-width: 768px) 100vw, 640px'}
                                                    style={{ objectFit: 'contain' }}
                                                />
                                                <span className={styles.riddleZoom}>
                                                    <Icon name={'FullscreenIn'} />
                                                </span>
                                            </button>
                                        ) : (
                                            <p className={styles.riddleText}>{t('game-quest-riddle-empty')}</p>
                                        )}
                                        <span className={styles.riddleNote}>
                                            {t(
                                                quest.mode === 'photos'
                                                    ? 'game-quest-photo-note'
                                                    : 'game-quest-riddle-note'
                                            )}
                                        </span>
                                        {now && (
                                            <Button
                                                mode={'primary'}
                                                size={'medium'}
                                                icon={'Position'}
                                                loading={busy}
                                                disabled={busy}
                                                label={t('game-here-button')}
                                                className={cn(styles.riddleButton, styles.desktopOnly)}
                                                onClick={() => onConfirm?.()}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <p className={styles.lockedText}>
                                        {quest.mode === 'riddles'
                                            ? t('game-quest-locked-riddle')
                                            : quest.mode === 'photos'
                                              ? t('game-quest-locked-photo')
                                              : t('game-quest-locked', { number: point.position - 1 })}
                                    </p>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ol>

            {zoomed && (
                <PhotoLightbox
                    photos={zoomed}
                    showLightbox={true}
                    onCloseLightBox={() => setZoomed(undefined)}
                />
            )}
        </>
    )
}
