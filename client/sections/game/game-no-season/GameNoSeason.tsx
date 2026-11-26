import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { GAME_HELP_HREF, QUESTS_HREF } from '@/utils/game'

import styles from './styles.module.sass'

/**
 * The head of the game page between seasons: no season goes on and none is announced. A calm
 * card in the place of the season card — the title (the page's h1), a short word that a new
 * season is coming and two ways on: the rules and the quests, which need no season.
 */
export const GameNoSeason: React.FC = () => {
    const { t } = useTranslation()

    return (
        <section className={styles.card}>
            <h1 className={styles.title}>{t('game-no-season-title')}</h1>
            <p className={styles.text}>{t('game-no-season-text')}</p>
            <div className={styles.actions}>
                <Button
                    mode={'secondary'}
                    size={'medium'}
                    link={GAME_HELP_HREF}
                    label={t('game-rules-title')}
                />
                <Button
                    mode={'secondary'}
                    size={'medium'}
                    link={QUESTS_HREF}
                    label={t('game-quests-title')}
                />
            </div>
        </section>
    )
}
