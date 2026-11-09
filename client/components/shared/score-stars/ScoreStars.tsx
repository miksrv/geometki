import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { addDecimalPoint } from '@/utils/helpers'

import styles from './styles.module.sass'

export interface ScoreStarsProps {
    /** The score, 1–5; an average is rounded to whole stars */
    value: number
    /** `small` — 14px (a line of text: the feed), `medium` — 16px (the reviews summary) */
    size?: 'small' | 'medium'
    /**
     * `stars` (default) — five stars, as many given as the score; `single` — one star and the
     * number, the rating stat of a place card tile (a list of many scores: the reputation history)
     */
    variant?: 'stars' | 'single'
    /** The accessible name; "Оценка: 4 из 5" without it */
    label?: string
    className?: string
}

/**
 * A score as five read-only stars, one look everywhere a score is shown (DESIGN.md → `ScoreStars`):
 * solid stars, the given ones in `--color-star`, the rest in `--surface-3`; `single` is one such
 * star and the number, as the rating of a place card tile. The interactive
 * stars of rating a place are `Rating`.
 */
export const ScoreStars: React.FC<ScoreStarsProps> = ({
    value,
    size = 'small',
    variant = 'stars',
    label,
    className
}) => {
    const { t } = useTranslation()
    const rounded = Math.round(value)
    const name = label ?? t('feed-score', { value: rounded, defaultValue: 'Оценка: {{value}} из 5' })

    if (variant === 'single') {
        return (
            <span
                className={cn(styles.single, styles[size], className)}
                role={'img'}
                aria-label={name}
            >
                <Icon
                    name={'StarFilled'}
                    className={styles.on}
                />
                <b aria-hidden={true}>{addDecimalPoint(value)}</b>
            </span>
        )
    }

    return (
        <span
            className={cn(styles.stars, styles[size], className)}
            role={'img'}
            aria-label={name}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                    key={star}
                    name={'StarFilled'}
                    className={cn(star <= rounded && styles.on)}
                />
            ))}
        </span>
    )
}
