import React from 'react'
import { Button, Icon, IconTypes } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch } from '@/app/store'

import styles from './styles.module.sass'

const PERKS: Array<{ key: string; icon: IconTypes }> = [
    { icon: 'Bookmark', key: 'bookmarks' },
    { icon: 'Map', key: 'visited' },
    { icon: 'Award', key: 'levels' }
]

/** The last screen for a guest who scrolled this far: why to sign up, in concrete gains */
export const HomeJoin: React.FC = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    return (
        <section
            className={styles.join}
            aria-labelledby={'home-join-title'}
        >
            <div>
                <h2
                    id={'home-join-title'}
                    className={styles.title}
                >
                    {t('home-join-title')}
                </h2>
                <p className={styles.text}>{t('home-join-text')}</p>
                <div className={styles.actions}>
                    <Button
                        mode={'secondary'}
                        size={'large'}
                        className={styles.primary}
                        label={t('home-join-sign-up')}
                        onClick={() => dispatch(openAuthDialog())}
                    />
                    <Button
                        mode={'outline'}
                        size={'large'}
                        icon={'Map'}
                        className={styles.secondary}
                        link={'/map'}
                        label={t('home-join-map')}
                    />
                </div>
            </div>

            <ul className={styles.perks}>
                {PERKS.map(({ key, icon }) => (
                    <li key={key}>
                        <span className={styles.perkIcon}>
                            <Icon name={icon} />
                        </span>
                        <div>
                            <b>{t(`home-join-perk-${key}-title`)}</b>
                            <span>{t(`home-join-perk-${key}-text`)}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}
