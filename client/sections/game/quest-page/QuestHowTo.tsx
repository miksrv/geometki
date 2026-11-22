import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { Section } from '@/components/shared'

import styles from './styles.module.sass'

interface QuestHowToProps {
    quest: Pick<ApiType.Game.Quest, 'mode' | 'bonus'>
    /** A guest's first step is to sign in */
    isGuest?: boolean
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
 * "Как пройти квест", until the walk is begun — the page a link opens for someone who has
 * never walked one: a paragraph on the page background on the whole mechanics (a walk with a
 * phone, the check-in, any number of goes, what it gives), then three steps as the cards of
 * the guest home page's "Как это работает" — a picture made of the site's real pieces over
 * "Шаг N", a title and a text of about the same length: begin it (a guest signs in first), go
 * to the point (as the quest's mode shows it: the marks of the timeline), "Я на месте" there
 * (with the experience of the whole quest in the corner).
 */
export const QuestHowTo: React.FC<QuestHowToProps> = ({ quest, isGuest }) => {
    const { t } = useTranslation()

    const third =
        quest.mode === 'steps' ? (
            <span className={cn(styles.howMark, styles.howMarkLocked)}>
                <Icon name={'Lock'} />
            </span>
        ) : (
            <span className={styles.howMark}>
                {quest.mode === 'riddles' ? '?' : quest.mode === 'photos' ? <Icon name={'Camera'} /> : 3}
            </span>
        )

    const steps = [
        {
            key: 'start',
            picture: (
                <span className={cn(styles.howButton, styles.howButtonPrimary)}>
                    {t(isGuest ? 'game-quest-sign-in' : 'game-quest-start')}
                </span>
            ),
            text: t(isGuest ? 'game-quest-howto-start-guest-text' : 'game-quest-howto-start-text'),
            title: t(isGuest ? 'game-quest-howto-start-guest' : 'game-quest-howto-start')
        },
        {
            key: 'go',
            picture: (
                <span className={styles.howMarks}>
                    <span className={cn(styles.howMark, styles.howMarkDone)}>{CHECK}</span>
                    <span className={cn(styles.howLeg, styles.howLegDone)} />
                    <span className={cn(styles.howMark, styles.howMarkCurrent)}>2</span>
                    <span className={cn(styles.howLeg, quest.mode === 'steps' && styles.howLegLocked)} />
                    {third}
                </span>
            ),
            text: t(`game-quest-howto-go-${quest.mode}`),
            title: t('game-quest-howto-go')
        },
        {
            key: 'here',
            picture: (
                <>
                    <span className={styles.howButton}>
                        <Icon name={'Position'} />
                        {t('game-here-button')}
                    </span>
                    <span className={styles.howXp}>{t('game-quest-howto-xp', { count: quest.bonus })}</span>
                </>
            ),
            text: t('game-quest-howto-here-text'),
            title: t('game-quest-howto-here')
        }
    ]

    return (
        <Section title={t('game-quest-howto-title')}>
            <p className={styles.howLede}>{t('game-quest-howto-lede')}</p>

            <ol className={styles.how}>
                {steps.map(({ key, picture, title, text }, index) => (
                    <li
                        key={key}
                        className={styles.howStep}
                    >
                        <div
                            className={styles.howPicture}
                            aria-hidden={true}
                        >
                            {picture}
                        </div>
                        <div className={styles.howBody}>
                            <span className={styles.howNumber}>{t('home-how-step', { number: index + 1 })}</span>
                            <h3 className={styles.howTitle}>{title}</h3>
                            <p className={styles.howText}>{text}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </Section>
    )
}
