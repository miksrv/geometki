import React from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { QUEST_MODE_ICONS, UserAvatar } from '@/components/shared'
import { Breadcrumbs } from '@/components/ui'
import { formatLength, formatWalkTime, questCoverSrc, questEditHref, QUESTS_HREF, walkMinutes } from '@/utils/game'

import { QuestHeroAction } from './QuestHeroAction'

import styles from './styles.module.sass'

/** The avatars of who walked the quest, the latest first */
const MAX_WALKERS = 5

interface QuestHeroProps {
    quest: ApiType.Game.QuestResponse
    /** An administrator gets "Редактировать" */
    canEdit?: boolean
    /** "Начать квест" */
    onStart: () => void
    /** "Отказаться от квеста" */
    onLeave: () => void
    busy?: boolean
}

/**
 * The head of a quest's page, a card, the same before the walk, during it and after: the
 * picture of the quest (`questCoverSrc()`: its first point's cover, the drawn map of the riddle
 * quests) | what it is ("Квест" and the mode), the name as the h1, the town with who walked it
 * right after it (their overlapping avatars and "1 человек прошёл квест", as the
 * place page's visitors, or that nobody has yet), the description and the
 * facts as a row of small tiles — the points, the length, the time on foot — with the walk's
 * action in the rest of that row (`QuestHeroAction`: "Начать квест", the progress and
 * "Отказаться от квеста", or "Квест пройден" with the day; under the tiles on phones). It is
 * what a person sees first after a link from a messenger: the picture
 * and one screen that says what this is.
 */
export const QuestHero: React.FC<QuestHeroProps> = ({ quest, canEdit, onStart, onLeave, busy }) => {
    const { t, i18n } = useTranslation()

    const cover = questCoverSrc(quest)

    const facts: Array<{ key: string; value: string; label: string }> = [
        { key: 'points', label: t('game-quest-fact-points'), value: String(quest.points) },
        { key: 'length', label: t('game-quest-fact-length'), value: formatLength(quest.length, i18n.language) },
        {
            key: 'time',
            label: t('game-quest-fact-time'),
            value: `≈ ${formatWalkTime(walkMinutes(quest.length, quest.points), t)}`
        }
    ]

    return (
        <header className={styles.heroWrap}>
            <div className={styles.heroTop}>
                <Breadcrumbs links={[{ link: QUESTS_HREF, text: t('game-quests-title') }]} />

                {canEdit && (
                    <Button
                        size={'medium'}
                        mode={'secondary'}
                        link={questEditHref(quest.id)}
                        label={t('game-quest-edit')}
                    />
                )}
            </div>

            <div className={styles.hero}>
                <div className={cn(styles.heroCover, !cover && styles.heroNoCover)}>
                    {cover ? (
                        <Image
                            src={cover}
                            alt={''}
                            fill
                            priority={true}
                            sizes={'(max-width: 768px) 100vw, 360px'}
                            style={{ objectFit: 'cover' }}
                        />
                    ) : (
                        <Icon name={QUEST_MODE_ICONS[quest.mode]} />
                    )}
                </div>

                <div className={styles.heroBody}>
                    <div className={styles.heroLabels}>
                        <span className={styles.overline}>{t('game-quest-overline')}</span>
                        <span className={styles.mode}>
                            <Icon name={QUEST_MODE_ICONS[quest.mode]} />
                            {t(`game-quest-mode-${quest.mode}`)}
                        </span>
                        {quest.status === 'draft' && <span className={styles.draft}>{t('game-quest-draft')}</span>}
                    </div>

                    <h1 className={styles.heroTitle}>{quest.title}</h1>

                    <div className={styles.heroMeta}>
                        {quest.location && (
                            <p className={styles.heroLocation}>
                                <Icon name={'Point'} />
                                {quest.location}
                            </p>
                        )}

                        {quest.walked ? (
                            <div className={styles.heroWalkers}>
                                {quest.walkers.length > 0 && (
                                    <div className={styles.faces}>
                                        {quest.walkers.slice(0, MAX_WALKERS).map((user) => (
                                            <UserAvatar
                                                key={user.id}
                                                user={user}
                                                size={'small'}
                                                hideOnlineIcon={true}
                                            />
                                        ))}
                                    </div>
                                )}
                                <p>
                                    <strong>{t('people-count', { count: quest.walked })}</strong>{' '}
                                    {t('game-quest-walked-tail', { count: quest.walked })}
                                </p>
                            </div>
                        ) : (
                            <p className={styles.heroWalkers}>{t('game-quest-walked-nobody')}</p>
                        )}
                    </div>

                    {quest.description && <p className={styles.heroText}>{quest.description}</p>}

                    <div className={styles.heroFoot}>
                        <dl className={styles.heroFacts}>
                            {facts.map(({ key, value, label }) => (
                                <div key={key}>
                                    <dt>{label}</dt>
                                    <dd>{value}</dd>
                                </div>
                            ))}
                        </dl>

                        <QuestHeroAction
                            quest={quest}
                            busy={busy}
                            onStart={onStart}
                            onLeave={onLeave}
                        />
                    </div>
                </div>
            </div>
        </header>
    )
}
