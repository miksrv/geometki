import React, { useId } from 'react'

import { hexagonPath } from '../level-badge/LevelBadge'

import styles from './styles.module.sass'

export type AwardSymbol = 'quest' | 'cold' | 'warm' | 'star'

/** The colour of the field of a drawn medal: a season's, the participant's neutral grey, a quest's */
export type AwardField = 'seasonal' | 'neutral' | 'quest'

interface AwardBadgeProps {
    /** The height in pixels; the hexagon is 0.866 of it wide */
    size: number
    /** The rim: the tier of the award, dark steel for an award without one (a season, a quest) */
    tier?: string
    /** The colour of the field; a seasonal achievement is `seasonal`, without it the field is the game's */
    category?: AwardField
    /** `achievements.group_slug`: picks the symbol (`season-2026-cold`, `pathfinder`, `quest-<slug>`) */
    group?: string
    /** A photo in place of the field and the symbol, cut to the hexagon (a quest without its medal: its first place) */
    photo?: string
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

/** The symbol of an award without a picture, by its group */
export const awardSymbol = (group?: string): AwardSymbol => {
    const season = /^season-\d{4}-(warm|cold)$/.exec(group ?? '')?.[1]

    if (season) {
        return season as AwardSymbol
    }

    if (group?.startsWith('quest-')) {
        return 'quest'
    }

    return 'star'
}

// The medal's frame in the proportions of tools/medals/medal.py: the rim, its inner slope, the
// dark gap, the thin inner line and the field, each a hexagon inside the previous one
const RIM = hexagonPath(0, 2)
const SLOPE = hexagonPath(2.9, 1.8)
const GAP = hexagonPath(4.9, 1.6)
const LINE = hexagonPath(6.1, 1.4)
const FIELD = hexagonPath(6.9, 1.2)

/**
 * The picture of an award that has none of its own yet, the medal of the drawn ones
 * (features/26 → "Award pictures"): one pointy-top hexagon in a metal rim lit from above; a tier
 * gives the metal and the colour of the field and the symbol is light, an award without a tier
 * has dark steel and its field and symbol in the group's colour — a season's warm or cold, the
 * quests' orange. Decorative: the award's name is next to it.
 */
export const AwardBadge: React.FC<AwardBadgeProps> = ({ size, tier = 'none', category, group, photo, className }) => {
    // Only the safe characters of the id: it goes into `url(#…)`
    const id = `award-${useId().replace(/[^\w-]/g, '')}`
    const symbol = awardSymbol(group)
    // The colour of a season is warm or cold; of a quest — the quests' orange
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
            <defs>
                <linearGradient
                    id={`${id}-rim`}
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={1}
                >
                    <stop
                        offset={0}
                        className={styles.rimLight}
                    />
                    <stop
                        offset={0.5}
                        className={styles.rimMiddle}
                    />
                    <stop
                        offset={1}
                        className={styles.rimDark}
                    />
                </linearGradient>
                <linearGradient
                    id={`${id}-slope`}
                    x1={0}
                    y1={1}
                    x2={0}
                    y2={0}
                    href={`#${id}-rim`}
                />
                <radialGradient
                    id={`${id}-field`}
                    r={0.6}
                >
                    <stop
                        offset={0}
                        className={styles.fieldCentre}
                    />
                    <stop
                        offset={1}
                        className={styles.fieldEdge}
                    />
                </radialGradient>
                <clipPath id={`${id}-clip`}>
                    <path d={FIELD} />
                </clipPath>
            </defs>
            <path
                d={RIM}
                fill={`url(#${id}-rim)`}
            />
            <path
                d={SLOPE}
                fill={`url(#${id}-slope)`}
            />
            <path
                className={styles.gap}
                d={GAP}
            />
            <path
                className={styles.line}
                d={LINE}
            />
            {photo ? (
                <>
                    <path
                        className={styles.photoField}
                        d={FIELD}
                    />
                    <image
                        href={photo}
                        x={0}
                        y={0}
                        width={100}
                        height={115.47}
                        preserveAspectRatio={'xMidYMid slice'}
                        clipPath={`url(#${id}-clip)`}
                    />
                </>
            ) : (
                <>
                    <path
                        d={FIELD}
                        fill={`url(#${id}-field)`}
                    />
                    <g className={styles.symbol}>{SYMBOLS[symbol]}</g>
                </>
            )}
        </svg>
    )
}
