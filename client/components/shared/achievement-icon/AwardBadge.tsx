import React from 'react'

import { hexagonPath } from '../level-badge/LevelBadge'

import styles from './styles.module.sass'

export type AwardSymbol = 'pin' | 'quest' | 'cold' | 'warm' | 'camera' | 'star' | 'shield' | 'flame' | 'compass'

interface AwardBadgeProps {
    /** The height in pixels; the hexagon is 0.866 of it wide */
    size: number
    /** The rim: the tier of the award, dark steel for an award without one (a season, a quest) */
    tier?: string
    /** `achievements.category`: the colour of the field */
    category?: string
    /** `achievements.group_slug`: picks the symbol (`season-2026-cold`, `pathfinder`, `wayfarer`) */
    group?: string
    className?: string
}

// One large cream symbol on a 100 × 115.47 hexagon, drawn around its centre (50, 57.7):
// no fine detail, it is shown at 40px
const SYMBOLS: Record<AwardSymbol, React.ReactNode> = {
    // The cold season: a snowflake, three crossed lines with branches
    cold: (
        <path
            className={styles.rays}
            d={
                'M50 28v60M24 43l52 30M76 43L24 73M50 38l-7-7M50 38l7-7M50 78l-7 7M50 78l7 7M33 48l-10 1M33 48l-3-9M67 68l10-1M67 68l3 9M67 48l10 1M67 48l3-9M33 68l-10-1M33 68l-3 9'
            }
        />
    ),
    camera: (
        <>
            <path d={'M26 42h11l5-8h16l5 8h11v36H26Z'} />
            <circle
                className={styles.detailFill}
                cx={50}
                cy={60}
                r={10}
            />
        </>
    ),
    compass: (
        <>
            <circle
                cx={50}
                cy={57.7}
                r={26}
            />
            <path
                className={styles.detailFill}
                d={'M50 37l8 20.7-8 20.7-8-20.7Z'}
            />
        </>
    ),
    flame: <path d={'M50 26c4 12 18 18 18 36a18 18 0 0 1-36 0c0-8 4-13 8-17 1 6 4 9 7 9 0-10-2-18 3-28Z'} />,
    // A map pin with a check mark: a confirmed visit
    pin: (
        <>
            <path d={'M50 24a24 24 0 0 0-24 24c0 17 19 37 22 40a3 3 0 0 0 4 0c3-3 22-23 22-40a24 24 0 0 0-24-24Z'} />
            <path
                className={styles.detail}
                d={'M39 48l8 8 14-16'}
            />
        </>
    ),
    // A dotted line between two points, a flag at its end
    quest: (
        <>
            <circle
                cx={32}
                cy={78}
                r={7}
            />
            <path d={'M66 30h4v52h-4Z'} />
            <path d={'M70 30l-26 9 26 9Z'} />
            <path
                className={styles.dotted}
                d={'M40 74c8-2 10-10 18-12'}
            />
        </>
    ),
    shield: <path d={'M50 26l24 8v20c0 16-10 28-24 34-14-6-24-18-24-34V34Z'} />,
    star: <path d={'M50 26l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2Z'} />,
    // The warm season: a sun over water
    warm: (
        <>
            <circle
                cx={50}
                cy={50}
                r={15}
            />
            <path
                className={styles.rays}
                d={'M50 24v6M50 70v0M26 50h6M68 50h6M33 33l4 4M67 33l-4 4'}
            />
            <path
                className={styles.rays}
                d={'M28 80c6-5 10-5 15 0s9 5 14 0 9-5 15 0'}
            />
        </>
    )
}

/** The symbol of an award without a picture, by its group and category */
export const awardSymbol = (group?: string, category?: string): AwardSymbol => {
    const season = /^season-\d{4}-(warm|cold)$/.exec(group ?? '')?.[1]

    if (season) {
        return season as AwardSymbol
    }

    if (group === 'wayfarer' || group?.startsWith('quest-')) {
        return 'quest'
    }

    switch (category) {
        case 'game':
            return 'pin'
        case 'content':
            return 'camera'
        case 'reputation':
            return 'shield'
        case 'consistency':
            return 'flame'
        case 'exploration':
            return 'compass'
        case undefined:
        default:
            return 'star'
    }
}

/**
 * The picture of an award that has none of its own yet, in the format of the drawn ones
 * (features/26 → "Award pictures", the enamel pin): one pointy-top hexagon, the rim is the
 * tier (dark steel without one), the field is the group's colour — a season's warm or
 * cold —, one large cream symbol. Decorative: the award's name is next to it.
 */
export const AwardBadge: React.FC<AwardBadgeProps> = ({ size, tier = 'none', category, group, className }) => {
    const symbol = awardSymbol(group, category)
    // The field of a season is warm or cold; of a quest — the quests' orange
    const field = ['warm', 'cold'].includes(symbol) ? symbol : symbol === 'quest' ? 'quest' : (category ?? 'game')

    return (
        <svg
            className={[styles.award, styles[`tier-${tier}`], styles[`field-${field}`], className]
                .filter(Boolean)
                .join(' ')}
            viewBox={'0 0 100 115.47'}
            height={size}
            width={Math.round(size * 0.866)}
            aria-hidden={true}
            focusable={false}
        >
            <path
                className={styles.rim}
                d={hexagonPath(0, 12)}
            />
            <path
                className={styles.field}
                d={hexagonPath(9, 9)}
            />
            <g className={styles.symbol}>{SYMBOLS[symbol]}</g>
        </svg>
    )
}
