import React from 'react'
import { cn, Icon, IconTypes } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { formatLength, formatWalkTime, isSecretMode, questCoverSrc, questHref, walkMinutes } from '@/utils/game'
import { formatDistance } from '@/utils/geo'

import styles from './styles.module.sass'

/** The icon of each mode: every point seen, one after another, riddles, photos */
export const QUEST_MODE_ICONS: Record<ApiType.Game.QuestMode, IconTypes> = {
    open: 'Map',
    riddles: 'QuestionCircle',
    photos: 'Camera',
    steps: 'Compass'
}

export interface QuestCardProps {
    quest: ApiType.Game.Quest
    /**
     * `medium` — the quests' list: a tile, the cover on top and the words under it; `small` —
     * a quest in another page's block (the home page, the shelf of begun walks), low: the
     * title and the walker's progress only
     */
    size?: 'medium' | 'small'
    /** A line over the title in place of the mode ("Вы проходите квест") */
    overline?: string
    /** A control at the foot, on the right ("Продолжить квест"); it stays above the card's link */
    action?: React.ReactNode
    /** 2 by default, 3 inside another titled block */
    headingLevel?: 2 | 3
    /** Preload the cover (above-the-fold cards only) */
    priority?: boolean
    /** The cover's `sizes` */
    sizes?: string
    className?: string
}

/**
 * The one card of a quest of the game (DESIGN.md → Cards → QuestCard), a card on the surface,
 * the whole of it one link — the title's, stretched over it.
 *
 * `medium`, a tile of the quests' list (the look of the trail catalogues): the cover of the
 * quest's first point on top (a riddle quest's places are the answers: the drawn map of the
 * riddle quests, `QUEST_RIDDLE_COVER`; a point without a cover: the mode's icon on a dotted
 * tinted field), over it the mode, the distance from the visitor (to the
 * start, or to the edge of a riddle quest's search zone); under it the town, the title, two lines of the description,
 * the facts with their icons — points, length, time on foot —, and at the foot who walked it
 * on the left and the walker's own state on the right: the experience it gives (a quest is no
 * part of a season: no geopoints), the green "walked", or the bar of a begun walk over the
 * whole foot.
 *
 * `small`, a quest being walked (the shelf of `/quests`, the home page): a low card the width of
 * the page — a 16:10 thumbnail on the left; the mode (or the `overline`), the title and one
 * line of the town, the points and the length; on the right the bar of the walk and the
 * `action` ("Продолжить квест", desktop only: on phones the whole card is the way in). On phones
 * the right part goes under the words.
 */
export const QuestCard: React.FC<QuestCardProps> = ({
    quest,
    size = 'medium',
    overline,
    action,
    headingLevel = 2,
    priority,
    sizes,
    className
}) => {
    const { t, i18n } = useTranslation()

    const Heading = headingLevel === 3 ? 'h3' : 'h2'
    const small = size === 'small'
    const finished = !!quest.walk?.finished
    const walking = !!quest.walk && !finished
    const confirmed = quest.walk?.confirmed ?? 0
    const progressText = t('game-quest-progress', { confirmed, total: quest.points })
    const cover = questCoverSrc(quest, small)

    const progress = (
        <span className={styles.progress}>
            <span
                className={styles.bar}
                role={'progressbar'}
                aria-valuemin={0}
                aria-valuemax={quest.points}
                aria-valuenow={confirmed}
                aria-label={progressText}
            >
                <span style={{ width: `${quest.points ? Math.round((confirmed / quest.points) * 100) : 0}%` }} />
            </span>
            <span className={styles.count}>{progressText}</span>
        </span>
    )

    const walked = (
        <span className={styles.walked}>
            <Icon name={'CheckCircle'} />
            {t('game-quest-walked')}
        </span>
    )

    const title = (
        <Heading className={styles.title}>
            <Link
                href={questHref(quest.id)}
                title={quest.title}
                className={styles.link}
            >
                {quest.title}
            </Link>
        </Heading>
    )

    const draft = quest.status === 'draft' && <span className={styles.draft}>{t('game-quest-draft')}</span>

    if (small) {
        const meta = [
            quest.location,
            t('game-quest-points', { count: quest.points }),
            formatLength(quest.length, i18n.language)
        ].filter(Boolean)

        return (
            <article className={cn(styles.questCard, styles.small, className)}>
                <div className={cn(styles.cover, !cover && styles.noCover)}>
                    {cover ? (
                        <Image
                            src={cover}
                            alt={''}
                            fill
                            priority={priority}
                            sizes={sizes ?? '(max-width: 768px) 120px, 208px'}
                            style={{ objectFit: 'cover' }}
                        />
                    ) : (
                        <Icon name={QUEST_MODE_ICONS[quest.mode]} />
                    )}
                </div>

                <div className={styles.body}>
                    <div className={styles.main}>
                        <div className={styles.labels}>
                            {overline ? (
                                <span className={styles.overline}>{overline}</span>
                            ) : (
                                <span className={styles.mode}>
                                    <Icon name={QUEST_MODE_ICONS[quest.mode]} />
                                    {t(`game-quest-mode-${quest.mode}`)}
                                </span>
                            )}
                            {draft}
                        </div>

                        {title}

                        <p className={styles.meta}>{meta.join(' · ')}</p>
                    </div>

                    {(finished || walking || action) && (
                        <div className={styles.side}>
                            {finished ? walked : walking ? progress : null}
                            {action && <div className={styles.action}>{action}</div>}
                        </div>
                    )}
                </div>
            </article>
        )
    }

    return (
        <article className={cn(styles.questCard, styles.tile, className)}>
            <div className={cn(styles.cover, !cover && styles.noCover)}>
                {cover ? (
                    <Image
                        src={cover}
                        alt={''}
                        fill
                        priority={priority}
                        sizes={sizes ?? '(max-width: 768px) 100vw, 360px'}
                        style={{ objectFit: 'cover' }}
                    />
                ) : (
                    // No cover at the first point: the mode's icon on a tinted field
                    <Icon name={QUEST_MODE_ICONS[quest.mode]} />
                )}

                <span className={styles.coverMode}>
                    <Icon name={QUEST_MODE_ICONS[quest.mode]} />
                    {t(`game-quest-mode-${quest.mode}`)}
                </span>

                {quest.distance !== undefined && (
                    <span
                        className={styles.coverDistance}
                        title={t(
                            isSecretMode(quest.mode) ? 'game-quest-zone-distance-title' : 'game-quest-distance-title'
                        )}
                    >
                        <Icon name={'Position'} />
                        {formatDistance(quest.distance, i18n.language)}
                    </span>
                )}
            </div>

            <div className={styles.body}>
                {(quest.location || draft) && (
                    <div className={styles.labels}>
                        {quest.location && (
                            <span className={styles.location}>
                                <Icon name={'Point'} />
                                {quest.location}
                            </span>
                        )}
                        {draft}
                    </div>
                )}

                {title}

                {quest.description && <p className={styles.text}>{quest.description}</p>}

                <ul className={styles.facts}>
                    <li title={t('game-quest-fact-points')}>
                        <Icon name={'PinDrop'} />
                        {t('game-quest-points', { count: quest.points })}
                    </li>
                    <li title={t('game-quest-fact-length')}>
                        <Icon name={'Ruler'} />
                        {formatLength(quest.length, i18n.language)}
                    </li>
                    <li title={t('game-quest-fact-time')}>
                        <Icon name={'Time'} />
                        {`≈ ${formatWalkTime(walkMinutes(quest.length, quest.points), t)}`}
                    </li>
                </ul>

                <div className={styles.footer}>
                    {walking ? (
                        progress
                    ) : (
                        <>
                            <span className={styles.walkers}>
                                <Icon name={'Users'} />
                                {quest.walked
                                    ? t('game-quest-walked-by', { count: quest.walked })
                                    : t('game-quest-walked-none')}
                            </span>

                            {finished ? (
                                walked
                            ) : (
                                <span
                                    className={styles.bonus}
                                    title={t('game-quest-experience', { count: quest.bonus })}
                                >
                                    {t('game-quest-bonus', { count: quest.bonus })}
                                </span>
                            )}
                        </>
                    )}
                    {action && <div className={styles.action}>{action}</div>}
                </div>
            </div>
        </article>
    )
}
