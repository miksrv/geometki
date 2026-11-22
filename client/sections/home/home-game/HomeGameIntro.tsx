import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { Section } from '@/components/shared'
import { GameSeason } from '@/sections/game/game-season'
import { GAME_HELP_HREF, GAME_HREF, QUESTS_HREF } from '@/utils/game'

import styles from './styles.module.sass'

interface HomeGameIntroProps {
    /** `GET /game` as a guest asks for it: the season and how many play, nothing of a visitor */
    game?: ApiType.Game.GetResponse | null
}

/**
 * The game on the guest home page: what it is in one line, then the card of the season that
 * goes on (or the next one, announced) — the same `GameSeason variant="home"` as the signed-in
 * page, without the visitor's line: its picture, name, time, how many play, "Войти и играть"
 * and the way to the rules, the rating and the quests. Rendered into the cached page, so nothing
 * of a visitor is in it; with no season at all there is nothing to show.
 */
export const HomeGameIntro: React.FC<HomeGameIntroProps> = ({ game }) => {
    const { t } = useTranslation()
    const season = game?.season

    if (!game || !season || (!season.current && !season.upcoming)) {
        return null
    }

    return (
        <Section title={t('home-game-intro-title')}>
            <p className={styles.lede}>{t('home-game-intro-lede')}</p>

            <GameSeason
                variant={'home'}
                season={season}
                totals={game.totals}
                links={[
                    { href: GAME_HELP_HREF, label: t('game-rules-title') },
                    { href: GAME_HREF, label: t('home-game-rating') },
                    { href: QUESTS_HREF, label: t('game-quests-title') }
                ]}
            />
        </Section>
    )
}
