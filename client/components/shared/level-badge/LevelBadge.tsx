import React, { useId } from 'react'
import { useTooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { levelColors } from '@/utils/levels'

import styles from './styles.module.sass'

interface LevelBadgeProps {
    level?: number
    size?: number
    /** Shows a "Level N" tooltip on hover/focus (off by default: the mobile badge is touch only) */
    showTooltip?: boolean
}

// A pointy-top hexagon in a 100-wide box: height = width × 2/√3
const VIEW_WIDTH = 100
const VIEW_HEIGHT = 115.47
const STROKE = 6
const CORNER_RADIUS = 12

/** The level in pixels never gets smaller than this, however small the badge */
const MIN_FONT_PX = 9

/**
 * The hexagon outline with rounded corners: every corner is cut `radius` along both of its
 * edges and the cut is bridged with a quadratic curve through the corner itself.
 */
export const hexagonPath = (inset: number, radius: number): string => {
    const cx = VIEW_WIDTH / 2
    const cy = VIEW_HEIGHT / 2
    const r = VIEW_HEIGHT / 2 - inset
    const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
    })

    const toward = (from: number[], to: number[]) => {
        const length = Math.hypot(to[0] - from[0], to[1] - from[1])
        return [from[0] + ((to[0] - from[0]) / length) * radius, from[1] + ((to[1] - from[1]) / length) * radius]
    }
    const round = (value: number) => Math.round(value * 100) / 100

    return (
        points
            .map((point, i) => {
                const start = toward(point, points[(i + 5) % 6])
                const end = toward(point, points[(i + 1) % 6])
                return `${i ? 'L' : 'M'}${round(start[0])},${round(start[1])} Q${round(point[0])},${round(point[1])} ${round(end[0])},${round(end[1])}`
            })
            .join(' ') + ' Z'
    )
}

const OUTLINE = hexagonPath(STROKE / 2, CORNER_RADIUS)

/**
 * A user's level as a hexagon in the colour of its tier: a soft vertical gradient, a darker
 * rim and the number with a rim-coloured outline, so it reads on the light tiers (grey, gold)
 * as well as on the dark ones. Drawn in SVG, so it is crisp and proportional at any size.
 */
export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 32, showTooltip }) => {
    const { t } = useTranslation()
    const gradientId = `level-badge-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`

    const value = level ?? 1
    const { fill, border } = levelColors(level)
    const label = t('level_num', { defaultValue: 'Уровень {{level}}', level: value })
    // The tooltip says what the badge is already named: not linked as a description, or a
    // screen reader would read the level twice
    const { triggerProps, tooltip } = useTooltip<SVGSVGElement>(
        showTooltip ? { content: label, describeTrigger: false } : null
    )

    const width = size + 2
    const height = Math.round(width * 1.15)
    // Two digits fill the width at 44% of it; one digit may be bigger
    const fontPx = Math.max(MIN_FONT_PX, width * (String(value).length > 1 ? 0.44 : 0.52))
    const fontSize = (fontPx / width) * VIEW_WIDTH

    return (
        <>
            <svg
                {...triggerProps}
                className={styles.badge}
                width={width}
                height={height}
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                role={'img'}
                aria-label={label}
            >
                <defs>
                    <linearGradient
                        id={gradientId}
                        x1={'0'}
                        y1={'0'}
                        x2={'0'}
                        y2={'1'}
                    >
                        <stop
                            offset={'0'}
                            stopColor={'#ffffff'}
                            stopOpacity={0.35}
                        />
                        <stop
                            offset={'0.55'}
                            stopColor={'#ffffff'}
                            stopOpacity={0}
                        />
                    </linearGradient>
                </defs>
                <path
                    d={OUTLINE}
                    fill={fill}
                    stroke={border}
                    strokeWidth={STROKE}
                    strokeLinejoin={'round'}
                />
                <path
                    d={OUTLINE}
                    fill={`url(#${gradientId})`}
                />
                <text
                    className={styles.level}
                    x={VIEW_WIDTH / 2}
                    y={VIEW_HEIGHT / 2}
                    dy={'0.36em'}
                    textAnchor={'middle'}
                    fontSize={fontSize}
                    stroke={border}
                    strokeWidth={fontSize * 0.14}
                >
                    {value}
                </text>
            </svg>
            {tooltip}
        </>
    )
}
