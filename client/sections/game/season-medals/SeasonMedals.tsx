import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { Section } from '@/components/shared'

import { SeasonMedal } from './SeasonMedal'

import styles from './styles.module.sass'

const KINDS: ApiType.Game.MedalKind[] = ['gold', 'silver', 'bronze', 'participant']

interface SeasonMedalsProps {
    medals: ApiType.Game.SeasonMedals
    /** The visitor's own medal of a closed season: highlighted */
    mine?: ApiType.Game.MedalKind | null
    className?: string
}

/**
 * "Медали сезона": what the season gives when it closes — gold, silver and bronze to places 1,
 * 2 and 3, the grey medal to everyone else who took part. A short paragraph and the four
 * medals with their captions; the visitor's own is marked once the season is closed.
 */
export const SeasonMedals: React.FC<SeasonMedalsProps> = ({ medals, mine, className }) => {
    const { t } = useTranslation()

    return (
        <Section
            title={t('game-medals-title')}
            className={className}
        >
            <p className={styles.text}>{t('game-medals-text')}</p>

            <ul className={styles.list}>
                {KINDS.map((kind) => (
                    <li
                        key={kind}
                        className={cn(styles.item, mine === kind && styles.mine)}
                        aria-current={mine === kind ? true : undefined}
                    >
                        <SeasonMedal
                            kind={kind}
                            image={medals[kind]}
                            size={72}
                        />
                        <span className={styles.caption}>{t(`game-medal-${kind}`)}</span>
                        {mine === kind && <span className={styles.yours}>{t('game-medal-yours')}</span>}
                    </li>
                ))}
            </ul>
        </Section>
    )
}
