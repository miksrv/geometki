import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

export interface GamePointsProps {
    value: number
    /** "+30": what an action gives; a plain number is a score already earned */
    plus?: boolean
    /**
     * `tint` — a pill on the brand tint (the default: lists, buttons' side notes);
     * `cover` — a dark pill over a photo; `plain` — no pill, a number in a line of text or a
     * table. Never another colour: the points are blue everywhere, earned or offered
     */
    variant?: 'tint' | 'cover' | 'plain'
    size?: 'small' | 'medium'
    /** What the number is, for the hint and screen readers: "30 очков сезона" */
    label?: string
    className?: string
}

/** The mark of the game's points: a map pin with a check — a confirmed visit */
export const GamePointsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        className={className}
        viewBox={'0 0 24 24'}
        aria-hidden={true}
        focusable={false}
    >
        <path
            fillRule={'evenodd'}
            d={
                'M12 2a7.5 7.5 0 0 0-7.5 7.5c0 5.3 6.2 11.5 7 12.2a.75.75 0 0 0 1 0c.8-.7 7-6.9 7-12.2A7.5 7.5 0 0 0 12 2Zm3.9 6.1a1 1 0 0 0-1.5-1.3l-3.3 3.7-1.4-1.5a1 1 0 1 0-1.5 1.4l2.2 2.3a1 1 0 0 0 1.5 0l4-4.6Z'
            }
        />
    </svg>
)

/**
 * Season points of the game, one look everywhere: the pin-with-a-check mark and the number
 * (tabular figures). What a place is worth is `plus`; a score is a plain number.
 */
export const GamePoints: React.FC<GamePointsProps> = ({
    value,
    plus,
    variant = 'tint',
    size = 'medium',
    label,
    className
}) => (
    <span
        className={cn(styles.points, styles[variant], size === 'small' && styles.small, className)}
        title={label}
    >
        <GamePointsIcon className={styles.icon} />
        <span aria-hidden={label ? true : undefined}>
            {plus ? '+' : ''}
            {formatThousands(value)}
        </span>
        {label && <span className={styles.srOnly}>{label}</span>}
    </span>
)
