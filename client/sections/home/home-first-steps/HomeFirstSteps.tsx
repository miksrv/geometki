import React from 'react'
import { Button, cn, Icon, IconTypes } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { GAME_HELP_HREF } from '@/utils/game'

import styles from './styles.module.sass'

type StepKey = 'visit' | 'photo' | 'place'

interface Step {
    key: StepKey
    icon: IconTypes
    href: string
    done: boolean
}

/**
 * A newcomer is someone who has neither explored a place nor added one: the home page shows
 * them the first steps instead of a row of zeros.
 */
export const isNewcomer = (statistic?: ApiModel.UserStatistic): boolean =>
    !!statistic && !statistic.visited && !statistic.place

interface HomeFirstStepsProps {
    statistic?: ApiModel.UserStatistic
}

/**
 * "С чего начать", the next step of a newcomer on the signed-in home page: the three things
 * the site is made of — exploring a place, a photo shot there, a place of one's own — each
 * with the one link that starts it, ticked once done. Gone after the first visit or place.
 */
export const HomeFirstSteps: React.FC<HomeFirstStepsProps> = ({ statistic }) => {
    const { t } = useTranslation()

    const steps: Step[] = [
        { done: !!statistic?.visited, href: '/places', icon: 'Point', key: 'visit' },
        { done: !!statistic?.photo, href: GAME_HELP_HREF, icon: 'Camera', key: 'photo' },
        { done: !!statistic?.place, href: '/places/create', icon: 'PlusCircle', key: 'place' }
    ]

    return (
        <section className={styles.card}>
            <h2 className={styles.title}>{t('home-steps-title')}</h2>
            <p className={styles.lede}>{t('home-steps-lede')}</p>

            <ol className={styles.steps}>
                {steps.map(({ key, icon, href, done }) => (
                    <li
                        key={key}
                        className={cn(styles.step, done && styles.done)}
                    >
                        <span
                            className={styles.mark}
                            aria-hidden={true}
                        >
                            <Icon name={done ? 'CheckCircle' : icon} />
                        </span>
                        <div className={styles.body}>
                            <h3>{t(`home-steps-${key}-title`)}</h3>
                            <p>{t(`home-steps-${key}-text`)}</p>
                        </div>
                        {done ? (
                            <span className={styles.doneLabel}>{t('home-steps-done')}</span>
                        ) : (
                            <Button
                                mode={'secondary'}
                                size={'medium'}
                                link={href}
                                label={t(`home-steps-${key}-button`)}
                            />
                        )}
                    </li>
                ))}
            </ol>
        </section>
    )
}
